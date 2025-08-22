import React from "react";

interface LoadingSkeletonProps {
  type: "text" | "card" | "chart" | "avatar" | "input" | "button" | "list";
  count?: number;
  height?: string;
  width?: string;
  className?: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type,
  count = 1,
  height,
  width,
  className = "",
}) => {
  const getSkeletonStyle = () => {
    let baseClasses = "animate-pulse bg-gray-200 rounded";

    switch (type) {
      case "text":
        return `${baseClasses} h-4 ${width || "w-full"}`;
      case "card":
        return `${baseClasses} ${height || "h-32"} ${width || "w-full"}`;
      case "chart":
        return `${baseClasses} ${height || "h-64"} ${width || "w-full"}`;
      case "avatar":
        return `${baseClasses} h-10 w-10 rounded-full`;
      case "input":
        return `${baseClasses} h-10 ${width || "w-full"}`;
      case "button":
        return `${baseClasses} h-10 ${width || "w-32"}`;
      case "list":
        return `${baseClasses} h-6 ${width || "w-full"}`;
      default:
        return baseClasses;
    }
  };

  const renderSkeleton = () => {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push(
        <div
          key={i}
          className={`${getSkeletonStyle()} ${className} ${
            i > 0 ? "mt-2" : ""
          }`}
          style={{ height, width }}
          aria-hidden="true"
        />
      );
    }
    return items;
  };

  return <>{renderSkeleton()}</>;
};

export default LoadingSkeleton;
