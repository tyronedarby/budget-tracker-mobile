import React, { createContext, useContext, useState, useCallback } from 'react';

interface DataContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <DataContext.Provider value={{ refreshTrigger, triggerRefresh }}>
      {children}
    </DataContext.Provider>
  );
}; 