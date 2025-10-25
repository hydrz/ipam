import { useState, useEffect } from 'react';
import { Plus, Trash2, Network, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import type { IPPool } from '../lib/ip-utils';
import {
  isValidCIDR,
  parseCIDR,
  cidrsOverlap,
  isChildOfParent,
  normalizeCIDR,
} from '../lib/ip-utils';
import {
  getAllPools,
  createPool,
  deletePool,
  getChildPools,
  cidrExists,
} from '../lib/db';

interface PoolFormData {
  name: string;
  cidr: string;
  description: string;
  parentId: number | null;
}

interface PoolTreeNode extends IPPool {
  children: PoolTreeNode[];
  totalIps: number;
  usedIps: number;
  level: number;
}

export default function IPAMManager({ client }: { client: 'load' | 'only' }) {
  const [pools, setPools] = useState<IPPool[]>([]);
  const [poolTree, setPoolTree] = useState<PoolTreeNode[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PoolFormData>({
    name: '',
    cidr: '',
    description: '',
    parentId: null,
  });
  const [validationError, setValidationError] = useState<string>('');
  const [cidrInfo, setCidrInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPools();
  }, []);

  const loadPools = async () => {
    try {
      const allPools = await getAllPools();
      setPools(allPools);
      buildPoolTree(allPools);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load pools:', error);
      setLoading(false);
    }
  };

  const buildPoolTree = (allPools: IPPool[]) => {
    const poolMap = new Map<number, PoolTreeNode>();
    const rootNodes: PoolTreeNode[] = [];

    // Initialize all pools as tree nodes
    allPools.forEach(pool => {
      const info = parseCIDR(pool.cidr);
      poolMap.set(pool.id!, {
        ...pool,
        children: [],
        totalIps: info.totalIps,
        usedIps: 0,
        level: 0,
      });
    });

    // Build tree structure and calculate levels
    allPools.forEach(pool => {
      const node = poolMap.get(pool.id!)!;
      if (pool.parentId === null || pool.parentId === undefined) {
        rootNodes.push(node);
      } else {
        const parent = poolMap.get(pool.parentId);
        if (parent) {
          node.level = parent.level + 1;
          parent.children.push(node);
        }
      }
    });

    // Calculate used IPs for each pool
    const calculateUsedIps = (node: PoolTreeNode): number => {
      let used = 0;
      node.children.forEach(child => {
        used += child.totalIps;
        child.usedIps = calculateUsedIps(child);
      });
      node.usedIps = used;
      return used;
    };

    rootNodes.forEach(calculateUsedIps);
    setPoolTree(rootNodes);
  };

  const validateCIDR = async (cidr: string, parentId: number | null) => {
    if (!cidr) {
      setValidationError('');
      setCidrInfo(null);
      return;
    }

    if (!isValidCIDR(cidr)) {
      setValidationError('Invalid CIDR format. Use format like 10.0.0.0/24');
      setCidrInfo(null);
      return;
    }

    const normalized = normalizeCIDR(cidr);
    if (normalized !== cidr) {
      setFormData(prev => ({ ...prev, cidr: normalized }));
      cidr = normalized;
    }

    const info = parseCIDR(cidr);
    setCidrInfo(info);

    // Check if CIDR already exists
    const exists = await cidrExists(cidr);
    if (exists) {
      setValidationError('This CIDR range already exists');
      return;
    }

    // If parent is selected, check if child is within parent
    if (parentId !== null) {
      const parent = pools.find(p => p.id === parentId);
      if (parent && !isChildOfParent(cidr, parent.cidr)) {
        setValidationError('Child pool must be within parent pool range');
        return;
      }
    }

    // Check for overlaps with sibling pools
    const siblings = pools.filter(p => p.parentId === parentId);
    for (const sibling of siblings) {
      if (cidrsOverlap(cidr, sibling.cidr)) {
        setValidationError(`Overlaps with existing pool: ${sibling.name} (${sibling.cidr})`);
        return;
      }
    }

    setValidationError('');
  };

  const handleCIDRChange = (value: string) => {
    setFormData(prev => ({ ...prev, cidr: value }));
    validateCIDR(value, formData.parentId);
  };

  const handleParentChange = (value: string) => {
    const parentId = value ? parseInt(value) : null;
    setFormData(prev => ({ ...prev, parentId }));
    if (formData.cidr) {
      validateCIDR(formData.cidr, parentId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validationError) {
      return;
    }

    if (!formData.name || !formData.cidr) {
      setValidationError('Name and CIDR are required');
      return;
    }

    try {
      await createPool({
        name: formData.name,
        cidr: formData.cidr,
        description: formData.description || undefined,
        parentId: formData.parentId,
      });

      setIsDialogOpen(false);
      setFormData({ name: '', cidr: '', description: '', parentId: null });
      setValidationError('');
      setCidrInfo(null);
      loadPools();
    } catch (error) {
      console.error('Failed to create pool:', error);
      setValidationError('Failed to create pool');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this pool? All child pools will also be deleted.')) {
      return;
    }

    try {
      await deletePool(id);
      loadPools();
    } catch (error) {
      console.error('Failed to delete pool:', error);
    }
  };

  const renderPoolNode = (node: PoolTreeNode) => {
    const usagePercent = (node.usedIps / node.totalIps) * 100;
    const availableIps = node.totalIps - node.usedIps;

    return (
      <div key={node.id} className="mb-2">
        <Card className={`ml-${node.level * 8}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{node.name}</CardTitle>
                  <CardDescription>{node.cidr}</CardDescription>
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleDelete(node.id!)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {node.description && (
              <p className="text-sm text-muted-foreground mb-3">{node.description}</p>
            )}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total IPs:</span>
                <span className="font-semibold">{node.totalIps.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Allocated:</span>
                <span className="font-semibold">{node.usedIps.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Available:</span>
                <span className="font-semibold text-green-600">{availableIps.toLocaleString()}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5 mt-2">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {usagePercent.toFixed(1)}% allocated
              </div>
            </div>
          </CardContent>
        </Card>
        {node.children.length > 0 && (
          <div className="ml-8 mt-2 border-l-2 border-border pl-4">
            {node.children.map(child => renderPoolNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Network className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading IPAM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">IP Address Pool Manager</h1>
          <p className="text-muted-foreground">
            Manage and allocate IP address pools with hierarchical structure
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Pool
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create New IP Pool</DialogTitle>
                <DialogDescription>
                  Add a new IP address pool. Specify CIDR notation and optional parent pool.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Pool Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Production Network"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cidr">CIDR *</Label>
                  <Input
                    id="cidr"
                    placeholder="e.g., 10.0.0.0/16"
                    value={formData.cidr}
                    onChange={(e) => handleCIDRChange(e.target.value)}
                    required
                  />
                  {cidrInfo && !validationError && (
                    <div className="text-xs space-y-1 text-muted-foreground bg-secondary p-2 rounded">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span>Valid CIDR</span>
                      </div>
                      <div>Network: {cidrInfo.networkAddress} - {cidrInfo.broadcastAddress}</div>
                      <div>Usable IPs: {cidrInfo.firstIp} - {cidrInfo.lastIp}</div>
                      <div>Total IPs: {cidrInfo.totalIps.toLocaleString()}</div>
                    </div>
                  )}
                  {validationError && (
                    <div className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationError}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parent">Parent Pool (Optional)</Label>
                  <select
                    id="parent"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.parentId || ''}
                    onChange={(e) => handleParentChange(e.target.value)}
                  >
                    <option value="">None (Root Pool)</option>
                    {pools.map(pool => (
                      <option key={pool.id} value={pool.id}>
                        {pool.name} ({pool.cidr})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setFormData({ name: '', cidr: '', description: '', parentId: null });
                    setValidationError('');
                    setCidrInfo(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!!validationError || !formData.name || !formData.cidr}>
                  Create Pool
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {poolTree.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Network className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No IP Pools Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first IP address pool to get started
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Pool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {poolTree.map(node => renderPoolNode(node))}
        </div>
      )}

      <div className="mt-8 p-4 bg-secondary rounded-lg">
        <h3 className="font-semibold mb-2">Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Total Pools</div>
            <div className="text-2xl font-bold">{pools.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Root Pools</div>
            <div className="text-2xl font-bold">{poolTree.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total IPs Managed</div>
            <div className="text-2xl font-bold">
              {poolTree.reduce((sum, pool) => sum + pool.totalIps, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
