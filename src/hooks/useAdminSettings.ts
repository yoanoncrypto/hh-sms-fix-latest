import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface AdminSettings {
  id: number;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

interface UseAdminSettingsReturn {
  settings: AdminSettings | null;
  loading: boolean;
  error: string | null;
  updatePhoneNumber: (phoneNumber: string | null) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useAdminSettings = (): UseAdminSettingsReturn => {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (fetchError) {
        // If no row exists, create one
        if (fetchError.code === "PGRST116") {
          const { data: newData, error: insertError } = await supabase
            .from("admin_settings")
            .insert([{ id: 1, phone_number: null }])
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          setSettings(newData);
        } else {
          throw fetchError;
        }
      } else {
        setSettings(data);
      }
    } catch (err) {
      console.error("Error fetching admin settings:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch admin settings"
      );
    } finally {
      setLoading(false);
    }
  };

  const updatePhoneNumber = async (
    phoneNumber: string | null
  ): Promise<boolean> => {
    try {
      setError(null);

      // Validate phone number format if provided
      if (phoneNumber && !/^\+\d{10,15}$/.test(phoneNumber)) {
        setError("Phone number must be in E.164 format (+1234567890)");
        return false;
      }

      const { data, error: updateError } = await supabase
        .from("admin_settings")
        .update({ phone_number: phoneNumber })
        .eq("id", 1)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setSettings(data);
      return true;
    } catch (err) {
      console.error("Error updating admin phone number:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update phone number"
      );
      return false;
    }
  };

  const refetch = async () => {
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    updatePhoneNumber,
    refetch,
  };
};
