import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4">
      <div className="card-elevated w-full max-w-md p-10 text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">404</h1>
        <p className="mb-6 text-muted-foreground">That page doesn&apos;t exist.</p>
        <Link
          to="/"
          className="inline-flex font-semibold text-primary underline-offset-4 hover:underline"
        >
          Back to GeoTraffic
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
