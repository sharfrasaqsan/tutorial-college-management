"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({ 
  className = "", 
  variant = "rect", 
  width, 
  height 
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  const variantClasses = {
    text: "rounded-md",
    rect: "rounded-2xl",
    circle: "rounded-full",
  };

  return (
    <div 
      style={style}
      className={`bg-slate-100 animate-pulse ${variantClasses[variant]} ${className}`}
    ></div>
  );
}
