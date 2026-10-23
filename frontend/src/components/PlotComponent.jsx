import React, { Component } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

const RawPlot = createPlotlyComponent(Plotly);

class PlotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn('Plot rendering error caught by boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel p-6 text-center text-muted">
          <p className="text-sm">Chart visualization could not be loaded.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Plot(props) {
  return (
    <PlotErrorBoundary>
      <RawPlot {...props} />
    </PlotErrorBoundary>
  );
}

