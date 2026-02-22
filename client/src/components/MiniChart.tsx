import { useEffect, useRef, useState } from "react";

type MiniChartProps = {
  data: number[];
  color: string;
  showLabels?: boolean;
  timeframe?: string;
};

const MiniChart = ({ data, color, showLabels = true, timeframe = "1D" }: MiniChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Track container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    // Initial measurement
    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const formatPrice = (price: number): string => {
    if (price >= 10000) {
      return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    } else if (price >= 1000) {
      return price.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Get X-axis labels based on timeframe
  const getXAxisLabels = (): { start: string; end: string } => {
    const now = new Date();

    switch (timeframe) {
      case "1D":
        return { start: "9:30", end: "Now" };
      case "1W": {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return {
          start: weekAgo.toLocaleDateString([], { month: "short", day: "numeric" }),
          end: "Today"
        };
      }
      case "1M": {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return {
          start: monthAgo.toLocaleDateString([], { month: "short", day: "numeric" }),
          end: "Today"
        };
      }
      case "3M": {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return {
          start: threeMonthsAgo.toLocaleDateString([], { month: "short" }),
          end: now.toLocaleDateString([], { month: "short" })
        };
      }
      case "1Y": {
        const yearAgo = new Date(now);
        yearAgo.setFullYear(now.getFullYear() - 1);
        return {
          start: yearAgo.toLocaleDateString([], { month: "short", year: "2-digit" }),
          end: now.toLocaleDateString([], { month: "short", year: "2-digit" })
        };
      }
      case "5Y": {
        const fiveYearsAgo = new Date(now);
        fiveYearsAgo.setFullYear(now.getFullYear() - 5);
        return {
          start: fiveYearsAgo.getFullYear().toString(),
          end: now.getFullYear().toString()
        };
      }
      default:
        return { start: "", end: "" };
    }
  };

  // Draw chart when data or dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalWidth = dimensions.width;
    const totalHeight = dimensions.height;

    if (totalWidth === 0 || totalHeight === 0) return;

    // Reserve space for labels
    const rightLabelWidth = showLabels ? 55 : 0;
    const bottomLabelHeight = showLabels ? 16 : 0;
    const width = totalWidth - rightLabelWidth;
    const height = totalHeight - bottomLabelHeight;

    // Set canvas DPI for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    // Clear the canvas
    ctx.clearRect(0, 0, totalWidth, totalHeight);

    // Calculate min and max for y-axis scaling
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = range * 0.15;

    const minWithPadding = min - padding;
    const maxWithPadding = max + padding;

    // Helper to get Y position
    const getY = (value: number) => {
      const normalizedY = (value - minWithPadding) / (maxWithPadding - minWithPadding);
      return height - normalizedY * height;
    };

    // Draw subtle horizontal grid lines
    ctx.strokeStyle = "rgba(128, 128, 128, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    const gridLines = 2;
    for (let i = 0; i <= gridLines; i++) {
      const y = (height / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw the sparkline
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Draw each point
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = getY(value);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Create a gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}30`);
    gradient.addColorStop(1, `${color}05`);

    // Fill the area under the line
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw labels if enabled
    if (showLabels) {
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#9ca3af";

      // Y-axis labels (right side)
      if (width > 30) {
        ctx.textAlign = "left";
        // High label (top)
        ctx.fillText(formatPrice(max), width + 4, 10);
        // Low label (bottom)
        ctx.fillText(formatPrice(min), width + 4, height - 3);
      }

      // X-axis labels (bottom)
      const xLabels = getXAxisLabels();
      if (xLabels.start && xLabels.end) {
        const xLabelY = height + 13;

        // Start label (left)
        ctx.textAlign = "left";
        ctx.fillText(xLabels.start, 0, xLabelY);

        // End label (right)
        ctx.textAlign = "right";
        ctx.fillText(xLabels.end, width, xLabelY);
      }
    }

  }, [data, color, showLabels, dimensions, timeframe]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default MiniChart;
