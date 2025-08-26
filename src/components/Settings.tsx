import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Save, Phone } from "lucide-react";
import { useAdminSettings } from "../hooks/useAdminSettings";
import {
  validatePhoneNumber,
  normalizePhoneNumber,
} from "../utils/phoneValidation";

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, loading, error, updatePhoneNumber } = useAdminSettings();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize phone number when settings are loaded
  React.useEffect(() => {
    if (settings && !isEditing) {
      setPhoneNumber(settings.phone_number || "");
    }
  }, [settings, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setValidationError(null);
    setSuccessMessage(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPhoneNumber(settings?.phone_number || "");
    setValidationError(null);
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setValidationError(null);
      setSuccessMessage(null);

      // Validate phone number if provided
      if (phoneNumber.trim()) {
        if (!validatePhoneNumber(phoneNumber.trim())) {
          setValidationError(
            "Please enter a valid phone number in international format (e.g., +359888123456)"
          );
          return;
        }
      }

      // Normalize phone number or use null if empty
      const normalizedPhone = phoneNumber.trim()
        ? normalizePhoneNumber(phoneNumber.trim())
        : null;

      const success = await updatePhoneNumber(normalizedPhone);

      if (success) {
        setIsEditing(false);
        setSuccessMessage(t("settings.savedSuccessfully"));
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setValidationError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-6">
            <SettingsIcon className="h-6 w-6 text-gray-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">
              {t("settings.title", "Settings")}
            </h1>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="text-sm text-green-600">{successMessage}</div>
            </div>
          )}

          <div className="space-y-6">
            {/* Global Phone Number Setting */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Phone className="h-5 w-5 text-gray-500 mr-2" />
                    {t(
                      "settings.globalPhoneNumber",
                      "Global Administrative Phone Number"
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {t(
                      "settings.globalPhoneNumberDescription",
                      "This phone number will be used across all campaigns and public displays. Leave empty to hide phone numbers."
                    )}
                  </p>
                </div>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150"
                  >
                    {t("edit")}
                  </button>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t("settings.phoneNumber", "Phone Number")}
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                          setValidationError(null);
                        }}
                        placeholder={t(
                          "settings.phoneNumberPlaceholder",
                          "+359888123456"
                        )}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          validationError ? "border-red-300" : "border-gray-300"
                        }`}
                        style={{ fontSize: "16px", minHeight: "44px" }}
                      />
                      {validationError && (
                        <p className="text-sm text-red-600 mt-1">
                          {validationError}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {t(
                          "settings.phoneNumberHelp",
                          "Enter phone number in international format (e.g., +359888123456). Leave empty to hide phone numbers from campaigns."
                        )}
                      </p>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? t("saving", "Saving...") : t("save", "Save")}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150"
                      >
                        {t("cancel", "Cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {settings?.phone_number ||
                          t("settings.noPhoneNumberSet", "No phone number set")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {settings?.phone_number
                          ? t(
                              "settings.currentPhoneNumber",
                              "Current administrative phone number"
                            )
                          : t(
                              "settings.noPhoneNumberDescription",
                              "Phone numbers will be hidden from campaigns"
                            )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
