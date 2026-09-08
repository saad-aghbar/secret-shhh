"use client";

import { Component, type ReactNode } from "react";

type SoftBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type SoftBoundaryState = {
  failed: boolean;
};

/** Keeps a failed lazy panel from taking down Chat. */
export class SoftBoundary extends Component<SoftBoundaryProps, SoftBoundaryState> {
  state: SoftBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
