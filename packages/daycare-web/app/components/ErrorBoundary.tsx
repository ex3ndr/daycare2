import { Component, type ReactNode } from "react";
import { Button } from "@/app/components/ui/button";
import { AlertTriangle } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">
                Something went wrong
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {this.state.error.message || "An unexpected error occurred"}
              </p>
            </div>
            <Button onClick={this.handleRetry}>Try again</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
