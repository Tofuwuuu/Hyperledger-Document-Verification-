import React from 'react';

export const Tab = ({ children, id, label }) => {
  return (
    <div className="py-4">
      {children}
    </div>
  );
};

export const Tabs = ({ children, activeTab, onChange }) => {
  // Filter out non-Tab components
  const tabs = React.Children.toArray(children).filter(
    (child) => child.type === Tab
  );

  return (
    <div>
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.props.id === activeTab;
            return (
              <button
                key={tab.props.id}
                onClick={() => onChange(tab.props.id)}
                className={`${
                  isActive
                    ? 'border-cvsu-green text-cvsu-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.props.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div>
        {tabs.find((tab) => tab.props.id === activeTab)}
      </div>
    </div>
  );
}; 