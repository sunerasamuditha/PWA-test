import React from 'react';

/**
 * JSONDiffViewer Component
 * Displays side-by-side comparison of JSON objects with highlighted differences
 */
const JSONDiffViewer = ({ before, after, maxDepth = 5 }) => {
  /**
   * Get all unique keys from both objects
   */
  const getAllKeys = (obj1, obj2) => {
    const keys = new Set();
    if (obj1 && typeof obj1 === 'object') {
      Object.keys(obj1).forEach(key => keys.add(key));
    }
    if (obj2 && typeof obj2 === 'object') {
      Object.keys(obj2).forEach(key => keys.add(key));
    }
    return Array.from(keys).sort();
  };

  /**
   * Compare two values and return difference type
   */
  const getDiffType = (val1, val2) => {
    if (val1 === undefined && val2 !== undefined) return 'added';
    if (val1 !== undefined && val2 === undefined) return 'removed';
    if (JSON.stringify(val1) !== JSON.stringify(val2)) return 'modified';
    return 'unchanged';
  };

  /**
   * Format value for display
   */
  const formatValue = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return '{...}';
    return String(value);
  };

  /**
   * Render a single value with appropriate styling
   */
  const renderValue = (value, diffType, depth = 0) => {
    if (depth > maxDepth) {
      return <span className="diff-value-truncated">...</span>;
    }

    const className = `diff-value diff-${diffType}`;

    // Handle primitive values
    if (value === null || value === undefined || typeof value !== 'object') {
      return <span className={className}>{formatValue(value)}</span>;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className={className}>[]</span>;
      }
      return (
        <div className={className}>
          <div className="diff-bracket">[</div>
          <div className="diff-nested">
            {value.map((item, index) => (
              <div key={index} className="diff-array-item">
                <span className="diff-index">{index}:</span>
                {renderValue(item, diffType, depth + 1)}
              </div>
            ))}
          </div>
          <div className="diff-bracket">]</div>
        </div>
      );
    }

    // Handle objects
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <span className={className}>{'{}'}</span>;
    }

    return (
      <div className={className}>
        <div className="diff-bracket">{'{'}</div>
        <div className="diff-nested">
          {keys.map(key => (
            <div key={key} className="diff-object-prop">
              <span className="diff-key">{key}:</span>
              {renderValue(value[key], diffType, depth + 1)}
            </div>
          ))}
        </div>
        <div className="diff-bracket">{'}'}</div>
      </div>
    );
  };

  /**
   * Render comparison row for a key
   */
  const renderRow = (key, beforeVal, afterVal) => {
    const diffType = getDiffType(beforeVal, afterVal);

    return (
      <div key={key} className={`diff-row diff-row-${diffType}`}>
        <div className="diff-key-column">
          <span className="diff-property-name">{key}</span>
          {diffType !== 'unchanged' && (
            <span className={`diff-badge diff-badge-${diffType}`}>
              {diffType}
            </span>
          )}
        </div>
        <div className="diff-value-column">
          <div className="diff-before">
            {beforeVal !== undefined ? renderValue(beforeVal, diffType) : <span className="diff-empty">-</span>}
          </div>
          <div className="diff-arrow">→</div>
          <div className="diff-after">
            {afterVal !== undefined ? renderValue(afterVal, diffType) : <span className="diff-empty">-</span>}
          </div>
        </div>
      </div>
    );
  };

  // Handle null/undefined inputs
  if (!before && !after) {
    return <div className="json-diff-viewer-empty">No data to compare</div>;
  }

  const keys = getAllKeys(before, after);

  if (keys.length === 0) {
    return <div className="json-diff-viewer-empty">Both objects are empty</div>;
  }

  return (
    <div className="json-diff-viewer">
      <div className="diff-header">
        <div className="diff-key-column-header">Property</div>
        <div className="diff-value-column-header">
          <div className="diff-before-header">Before</div>
          <div className="diff-arrow-header"></div>
          <div className="diff-after-header">After</div>
        </div>
      </div>
      <div className="diff-body">
        {keys.map(key => renderRow(key, before?.[key], after?.[key]))}
      </div>
      <div className="diff-legend">
        <div className="diff-legend-item">
          <span className="diff-badge diff-badge-added">added</span>
          <span className="diff-legend-text">New field</span>
        </div>
        <div className="diff-legend-item">
          <span className="diff-badge diff-badge-removed">removed</span>
          <span className="diff-legend-text">Deleted field</span>
        </div>
        <div className="diff-legend-item">
          <span className="diff-badge diff-badge-modified">modified</span>
          <span className="diff-legend-text">Changed value</span>
        </div>
      </div>
    </div>
  );
};

export default JSONDiffViewer;
