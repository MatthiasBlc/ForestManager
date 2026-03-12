import { ReactNode } from "react";

interface DataContainerProps {
  isLoading: boolean;
  error: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}

function DataContainer({
  isLoading,
  error,
  isEmpty,
  emptyMessage,
  emptyAction,
  children,
}: DataContainerProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-base-content/60 mb-4">{emptyMessage || "No data found"}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}

export default DataContainer;
