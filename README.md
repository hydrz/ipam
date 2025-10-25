# IPAM - IP Address Pool Manager

A modern IP Address Management (IPAM) system built with Astro, shadcn/ui, and SQLite WASM. This system provides efficient IP address pool management with hierarchical structure, overlap detection, and real-time validation.

## 功能特性 / Features

- **基于地址池分配** - Flexible IP address pool management with pool-based allocation
- **多层级分配** - Multi-level allocation supporting subnet division and hierarchical management (parent-child pool relationships)
- **层级可视化展示** - Intuitive visualization of address pool usage and hierarchical structure with charts
- **重叠检测** - Automatic CIDR overlap detection between sibling pools
- **范围验证** - Ensures child pools are within parent pool ranges
- **自动初始化** - Automatic database creation and configuration
- **美观设计** - Professional user interface with modern design
- **输入验证** - Automatic validation of CIDR format and IP address legality
- **CIDR 支持** - Complete support for CIDR notation (/8 to /32)
- **实时反馈** - Real-time status feedback showing allocatable, overlapping, and selected states during creation

## Tech Stack

- **Frontend Framework**: [Astro](https://astro.build/) - Fast, modern web framework
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) - Beautiful, accessible components built with Radix UI
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- **Database**: [SQLite WASM](https://sqlite.org/wasm) - Client-side SQLite database
- **Icons**: [Lucide React](https://lucide.dev/) - Beautiful & consistent icon toolkit

## Installation

```bash
# Clone the repository
git clone https://github.com/hydrz/ipam.git
cd ipam

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

### Creating an IP Pool

1. Click the "Create Pool" button
2. Fill in the required fields:
   - **Pool Name**: A descriptive name for your pool (e.g., "Production Network")
   - **CIDR**: The IP range in CIDR notation (e.g., "10.0.0.0/16")
   - **Parent Pool** (Optional): Select a parent pool if creating a subnet
   - **Description** (Optional): Add additional details about the pool

3. The system will automatically:
   - Validate the CIDR format
   - Check for overlaps with sibling pools
   - Verify the range is within the parent pool (if applicable)
   - Display real-time feedback about the pool configuration

### Pool Hierarchy

- **Root Pools**: Pools without a parent, representing top-level networks
- **Child Pools**: Subnets created within a parent pool
- Pools display their allocation status with visual progress bars
- Tree structure shows parent-child relationships clearly

### Validation Rules

- CIDR format must be valid (e.g., `10.0.0.0/24`)
- Prefix length must be between /8 and /32
- Child pools must be entirely within their parent's range
- Sibling pools cannot overlap with each other
- Each CIDR can only be used once in the system

### Pool Information Display

Each pool card shows:
- Pool name and CIDR notation
- Total IP addresses in the pool
- Allocated IP addresses (used by child pools)
- Available IP addresses
- Usage percentage with visual indicator
- Network and broadcast addresses

## Features in Detail

### CIDR Validation

The system validates CIDR notation in real-time:
- Checks IP address format (four octets, 0-255 each)
- Validates prefix length (/8 to /32)
- Normalizes network addresses automatically
- Shows network range and usable IP addresses

### Overlap Detection

Automatic detection of overlapping ranges:
- Compares CIDR ranges at the same hierarchy level
- Prevents creation of overlapping sibling pools
- Provides clear error messages indicating which pool overlaps

### Hierarchical Management

- Create nested pool structures
- Each child pool allocates space from its parent
- Parent pools show total allocation including all children
- Delete pools and their children with cascade deletion

### Database

Uses SQLite WASM for client-side data persistence:
- No server required
- Data stored in browser
- Fast queries and operations
- SQL-based with foreign key constraints

## Development

### Project Structure

```
ipam/
├── src/
│   ├── components/
│   │   ├── IPAMManager.tsx      # Main IPAM component
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts                # Database operations
│   │   ├── ip-utils.ts          # IP/CIDR utilities
│   │   └── utils.ts             # Helper functions
│   ├── pages/
│   │   └── index.astro          # Main page
│   └── styles/
│       └── globals.css          # Global styles
├── astro.config.mjs             # Astro configuration
├── tailwind.config.mjs          # Tailwind configuration
└── tsconfig.json                # TypeScript configuration
```

### Key Functions

#### IP Utilities (`src/lib/ip-utils.ts`)
- `isValidCIDR()`: Validate CIDR notation
- `parseCIDR()`: Parse CIDR and calculate ranges
- `cidrsOverlap()`: Check if two CIDRs overlap
- `isChildOfParent()`: Verify child is within parent range
- `normalizeCIDR()`: Normalize CIDR to proper network address

#### Database Operations (`src/lib/db.ts`)
- `initDatabase()`: Initialize SQLite database
- `getAllPools()`: Retrieve all IP pools
- `createPool()`: Create new IP pool
- `deletePool()`: Delete pool and children
- `getChildPools()`: Get pools by parent ID

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Support

For issues and questions, please open an issue on GitHub.
