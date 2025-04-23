import { useEffect, useRef } from "react";

type MiniChartProps = {
  data: number[];
  color: string;
  height?: number;
  width?: number;
};

const MiniChart = ({ data, color, height = 40, width = 100 }: MiniChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas DPI for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate min and max for y-axis scaling
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const padding = range * 0.2; // Add 20% padding

    // Draw the sparkline
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    // Draw each point
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      // Normalize the y value to fit within the canvas height with padding
      const y = height - ((value - (min - padding)) / ((max + padding) - (min - padding))) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Create a gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}40`); // 25% opacity
    gradient.addColorStop(1, `${color}00`); // 0% opacity

    // Fill the area under the line
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

  }, [data, color, height, width]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default MiniChart;
