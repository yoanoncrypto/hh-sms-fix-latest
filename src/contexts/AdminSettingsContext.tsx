import React, { createContext, useContext, useEffect, useState } from "react";
import { useAdminSettings } from "../hooks/useAdminSettings";

interface AdminSettingsContextType {
  adminPhoneNumber: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AdminSettingsContext = createContext<
  AdminSettingsContextType | undefined
>(undefined);

export const useAdminSettingsContext = () => {
  const context = useContext(AdminSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAdminSettingsContext must be used within an AdminSettingsProvider"
    );
  }
  return context;
};

interface AdminSettingsProviderProps {
  children: React.ReactNode;
}

export const AdminSettingsProvider: React.FC<AdminSettingsProviderProps> = ({
  children,
}) => {
  const { settings, loading, error, refetch } = useAdminSettings();
  const [adminPhoneNumber, setAdminPhoneNumber] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setAdminPhoneNumber(settings.phone_number);
    }
  }, [settings]);

  const value: AdminSettingsContextType = {
    adminPhoneNumber,
    loading,
    error,
    refetch,
  };

  return (
    <AdminSettingsContext.Provider value={value}>
      {children}
    </AdminSettingsContext.Provider>
  );
};
