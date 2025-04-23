# Stock.Tool

A sophisticated React and Node.js based stock analysis platform that combines interactive financial data visualization with intelligent insights and user-friendly design.

## Features

- **Market Dashboard**: Get a comprehensive overview of stock indices with customizable timeframes (1D, 1W, 1M, 3M, 1Y)
- **Stock Details**: View detailed information for individual stocks including price charts, company info, and technical indicators
- **Watchlists**: Create, manage, and organize collections of your favorite stocks for easy tracking
- **Financial News**: Stay updated with the latest market news and company-specific headlines
- **Technical Analysis**: Review key technical indicators and market signals

## Tech Stack

- **Frontend**: React with TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: Node.js with Express
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Charts**: Recharts for data visualization
- **Data Storage**: In-memory storage with TypeScript interfaces

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/mstockert/Stock.Tool.git
   cd Stock.Tool
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm run dev
   ```

4. Open your browser and navigate to the local development server (typically http://localhost:3000)

## Usage

- Use the sidebar to navigate between Dashboard, Markets, and Watchlist views
- Click on any stock symbol or market index to view detailed information
- Create and manage watchlists to track your favorite stocks
- Toggle between different timeframes (1D, 1W, 1M, 3M, 1Y) to view historical data

## Development Notes

- The application uses an in-memory storage system for quick prototyping
- Stock data is provided through a simulated API service
- Responsive design supports desktop, tablet, and mobile viewing

## License

[MIT](LICENSE)