import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Calendar,
  MapPin,
  Users,
  X,
  Save,
  Upload,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Campaign } from "../types";
import { useStorageUpload } from "../hooks/useStorageUpload";
import { generateShortId } from "../utils/shortId";
import LocationMapPicker from "./LocationMapPicker";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const CampaignManagement: React.FC = () => {
  const { t } = useTranslation();
  const { uploadState, uploadFile, clearUpload } = useStorageUpload();

  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "" as "event" | "promotion" | "",
    imageUrl: "",
    date: null as Date | null,
    endDate: null as Date | null,
    location: "",
    latitude: null as number | null,
    longitude: null as number | null,
    rsvpEnabled: false,
    isActive: false, // Default to false for new campaigns
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "",
      imageUrl: "",
      date: null,
      endDate: null,
      location: "",
      latitude: null,
      longitude: null,
      rsvpEnabled: false,
      isActive: false, // Default to false for new campaigns
    });
    setFormErrors({});
    setEditingCampaign(null);
    setUploadedImageUrl(null);
    clearUpload();
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t("campaigns.nameRequiredError");
    }

    if (!formData.description.trim()) {
      errors.description = t("campaigns.descriptionRequiredError");
    }

    if (!formData.type) {
      errors.type = t("campaigns.typeRequiredError");
    }

    // Image is required
    const finalImageUrl = uploadedImageUrl || formData.imageUrl;
    if (!finalImageUrl) {
      errors.image = t("campaigns.imageRequiredError");
    }

    // For events, date and location are required
    if (formData.type === "event") {
      if (!formData.date) {
        errors.date = t("campaigns.dateRequiredError");
      }

      if (!formData.location.trim()) {
        errors.location = t("campaigns.locationRequiredError");
      }

      if (formData.latitude === null || formData.longitude === null) {
        errors.coordinates = t("campaigns.latitudeRequiredError");
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const finalImageUrl = uploadedImageUrl || formData.imageUrl;
      
      // If endDate is null, use the date value
      const finalEndDate = formData.endDate || formData.date;

      const campaignData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        image_url: finalImageUrl,
        date: formData.date?.toISOString() || null,
        end_date: finalEndDate?.toISOString() || null,
        location: formData.location.trim() || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        rsvp_enabled: formData.rsvpEnabled,
        is_active: formData.isActive,
      };

      if (editingCampaign) {
        // Update existing campaign
        const { error } = await supabase
          .from("campaigns")
          .update(campaignData)
          .eq("id", editingCampaign.id);

        if (error) throw error;
      } else {
        // Create new campaign with unique short_id
        let shortId: string;
        let attempts = 0;
        const maxAttempts = 100;

        do {
          shortId = generateShortId();
          const { data: existing } = await supabase
            .from("campaigns")
            .select("id")
            .eq("short_id", shortId)
            .single();

          if (!existing) break;
          attempts++;
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
          throw new Error("Could not generate unique short ID");
        }

        const { error } = await supabase
          .from("campaigns")
          .insert([{ ...campaignData, short_id: shortId }]);

        if (error) throw error;
      }

      await fetchCampaigns();
      setShowModal(false);
      resetForm();
    } catch (err) {
      setFormErrors({
        submit: err instanceof Error ? err.message : "Failed to save campaign",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      imageUrl: campaign.image_url || "",
      date: campaign.date ? new Date(campaign.date) : null,
      endDate: campaign.end_date ? new Date(campaign.end_date) : null,
      location: campaign.location || "",
      latitude: campaign.latitude,
      longitude: campaign.longitude,
      rsvpEnabled: campaign.rsvp_enabled,
      isActive: campaign.is_active,
    });
    setUploadedImageUrl(null);
    clearUpload();
    setFormErrors({});
    setShowModal(true);
  };

  const handleDeleteCampaign = (campaign: Campaign) => {
    setDeletingCampaign(campaign);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingCampaign) return;

    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", deletingCampaign.id);

      if (error) throw error;

      await fetchCampaigns();
      setShowDeleteModal(false);
      setDeletingCampaign(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingCampaign(null);
  };

  const handleImageUpload = async (file: File) => {
    const url = await uploadFile(file);
    if (url) {
      setUploadedImageUrl(url);
      setFormData({ ...formData, imageUrl: "" }); // Clear manual URL when file is uploaded
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData({
      ...formData,
      latitude: lat,
      longitude: lng,
    });
  };

  const copyPublicLink = async (campaign: Campaign) => {
    const publicUrl = `${window.location.origin}/c/${campaign.short_id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  // Filter campaigns based on search
  const filteredCampaigns = campaigns.filter((campaign) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      campaign.name.toLowerCase().includes(searchLower) ||
      campaign.description.toLowerCase().includes(searchLower) ||
      campaign.type.toLowerCase().includes(searchLower) ||
      (campaign.location && campaign.location.toLowerCase().includes(searchLower))
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">{t("loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="mobile-heading font-bold text-gray-900">
            {t("campaigns.title")}
          </h2>
          <p className="text-gray-600">{t("campaigns.subtitle")}</p>
        </div>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto mobile-button bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("campaigns.createCampaign")}
        </button>
      </div>

      {/* Search */}
      <div className="mobile-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder={t("campaigns.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mobile-input pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {searchTerm && (
          <p className="text-sm text-gray-600 mt-2">
            {t("campaigns.foundResults", {
              count: filteredCampaigns.length,
              searchTerm,
            })}
          </p>
        )}
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            {searchTerm ? t("campaigns.noResults") : t("campaigns.noCampaigns")}
          </h3>
          <p className="text-gray-600">
            {searchTerm
              ? t("campaigns.noResultsSubtitle")
              : t("campaigns.noCampaignsSubtitle")}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="mt-4 text-blue-600 hover:text-blue-500"
            >
              {t("campaigns.clearSearch")}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Campaign Image */}
                <div className="relative h-48">
                  {campaign.image_url ? (
                    <img
                      src={campaign.image_url}
                      alt={campaign.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                        campaign.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {campaign.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        campaign.type === "event"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {campaign.type === "event"
                        ? t("campaigns.event")
                        : t("campaigns.promotion")}
                    </span>
                  </div>
                </div>

                {/* Campaign Content */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
                    {campaign.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {campaign.description}
                  </p>

                  {/* Campaign Details */}
                  <div className="space-y-2 mb-4">
                    {campaign.date && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>
                          {new Date(campaign.date).toLocaleDateString()} -{" "}
                          {campaign.end_date
                            ? new Date(campaign.end_date).toLocaleDateString()
                            : "No end date"}
                        </span>
                      </div>
                    )}
                    {campaign.location && (
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="line-clamp-1">{campaign.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => window.open(`/admin/campaigns/${campaign.id}`, "_blank")}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(campaign)}
                        className="text-yellow-600 hover:text-yellow-800 p-1"
                        title="Edit campaign"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyPublicLink(campaign)}
                        className="text-gray-600 hover:text-gray-800 p-1"
                        title="Copy public link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          window.open(`/c/${campaign.short_id}`, "_blank")
                        }
                        className="text-green-600 hover:text-green-800 p-1"
                        title="View public page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredCampaigns.length)}{" "}
                of {filteredCampaigns.length} campaigns
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingCampaign
                    ? t("campaigns.editCampaign")
                    : t("campaigns.createNew")}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("campaigns.nameRequired")}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`mobile-input ${
                      formErrors.name ? "border-red-300" : ""
                    }`}
                    placeholder="Enter campaign name..."
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("campaigns.descriptionRequired")}
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={4}
                    className={`mobile-input ${
                      formErrors.description ? "border-red-300" : ""
                    }`}
                    placeholder="Enter campaign description..."
                  />
                  {formErrors.description && (
                    <p className="text-sm text-red-600 mt-1">
                      {formErrors.description}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("campaigns.typeRequired")}
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as "event" | "promotion",
                      })
                    }
                    className={`mobile-input ${
                      formErrors.type ? "border-red-300" : ""
                    }`}
                  >
                    <option value="">{t("campaigns.selectType")}</option>
                    <option value="event">{t("campaigns.event")}</option>
                    <option value="promotion">{t("campaigns.promotion")}</option>
                  </select>
                  {formErrors.type && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.type}</p>
                  )}
                </div>

                {/* Is Active Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Status
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, isActive: !formData.isActive })
                      }
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                        formData.isActive
                          ? "bg-green-50 border-green-200 text-green-800"
                          : "bg-gray-50 border-gray-200 text-gray-600"
                      }`}
                    >
                      {formData.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                      <span className="text-sm font-medium">
                        {formData.isActive ? "Active" : "Inactive"}
                      </span>
                    </button>
                    <p className="text-xs text-gray-500">
                      {formData.isActive
                        ? "Campaign is visible to the public"
                        : "Campaign is hidden from the public"}
                    </p>
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("campaigns.image")} *
                  </label>

                  {/* File Upload */}
                  <div className="mb-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <label htmlFor="image-upload" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            {t("campaigns.dropImage")}{" "}
                            <span className="text-blue-600">
                              {t("campaigns.browse")}
                            </span>
                          </span>
                          <input
                            id="image-upload"
                            name="image-upload"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) =>
                              e.target.files?.[0] &&
                              handleImageUpload(e.target.files[0])
                            }
                          />
                        </label>
                        <p className="mt-1 text-xs text-gray-500">
                          {t("campaigns.imageFormats")}
                        </p>
                      </div>
                    </div>

                    {uploadState.uploading && (
                      <div className="mt-2">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            <span className="text-sm text-blue-800">
                              {t("campaigns.uploadingImage")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {uploadState.error && (
                      <div className="mt-2 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-600">{uploadState.error}</p>
                      </div>
                    )}

                    {uploadedImageUrl && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600">
                          Image uploaded successfully!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Manual URL Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("campaigns.enterImageUrl")}
                    </label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, imageUrl: e.target.value })
                      }
                      className="mobile-input"
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t("campaigns.imageUrlOverride")}
                    </p>
                  </div>

                  {formErrors.image && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.image}</p>
                  )}
                </div>

                {/* Start Date & Time */}
                {formData.type === "event" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date & Time *
                    </label>
                    <DatePicker
                      selected={formData.date}
                      onChange={(date) => setFormData({ ...formData, date })}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="MMMM d, yyyy h:mm aa"
                      className={`mobile-input ${
                        formErrors.date ? "border-red-300" : ""
                      }`}
                      placeholderText="Select start date and time..."
                      minDate={new Date()}
                    />
                    {formErrors.date && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.date}</p>
                    )}
                  </div>
                )}

                {/* End Date & Time */}
                {formData.type === "event" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date & Time
                    </label>
                    <DatePicker
                      selected={formData.endDate}
                      onChange={(date) => setFormData({ ...formData, endDate: date })}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="MMMM d, yyyy h:mm aa"
                      className="mobile-input"
                      placeholderText="Select end date and time (optional)..."
                      minDate={formData.date || new Date()}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If left empty, will default to start date & time
                    </p>
                  </div>
                )}

                {/* Location */}
                {formData.type === "event" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("campaigns.location")} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className={`mobile-input ${
                        formErrors.location ? "border-red-300" : ""
                      }`}
                      placeholder={t("campaigns.locationPlaceholder")}
                    />
                    {formErrors.location && (
                      <p className="text-sm text-red-600 mt-1">
                        {formErrors.location}
                      </p>
                    )}
                  </div>
                )}

                {/* Map Location Picker */}
                {formData.type === "event" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("campaigns.mapLocation")} *
                    </label>
                    <LocationMapPicker
                      onLocationSelect={handleLocationSelect}
                      initialLat={formData.latitude || undefined}
                      initialLng={formData.longitude || undefined}
                    />
                    {formErrors.coordinates && (
                      <p className="text-sm text-red-600 mt-1">
                        {formErrors.coordinates}
                      </p>
                    )}
                  </div>
                )}

                {/* RSVP Toggle */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="rsvp-enabled"
                    checked={formData.rsvpEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, rsvpEnabled: e.target.checked })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="rsvp-enabled"
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("campaigns.enableRsvp")}
                  </label>
                </div>

                {formErrors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{formErrors.submit}</p>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {editingCampaign ? t("update") : t("create")}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editingCampaign
                          ? t("campaigns.editCampaign")
                          : t("campaigns.createCampaign")}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {t("campaigns.deleteConfirmTitle")}
                </h2>
                <button
                  onClick={cancelDelete}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-gray-800 mb-6">
                {t("campaigns.deleteConfirmMessage", {
                  name: deletingCampaign.name,
                })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style>{`
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* React DatePicker custom styles */
        .react-datepicker-wrapper {
          width: 100%;
        }
        
        .react-datepicker__input-container input {
          width: 100% !important;
        }
        
        .react-datepicker {
          font-family: inherit;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        
        .react-datepicker__header {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          border-radius: 0.5rem 0.5rem 0 0;
        }
        
        .react-datepicker__current-month {
          color: #374151;
          font-weight: 600;
        }
        
        .react-datepicker__day-name {
          color: #6b7280;
          font-weight: 500;
        }
        
        .react-datepicker__day--selected {
          background-color: #2563eb;
          color: white;
        }
        
        .react-datepicker__day--keyboard-selected {
          background-color: #3b82f6;
          color: white;
        }
        
        .react-datepicker__day:hover {
          background-color: #dbeafe;
          color: #1e40af;
        }
        
        .react-datepicker__time-container {
          border-left: 1px solid #e5e7eb;
        }
        
        .react-datepicker__time-list-item--selected {
          background-color: #2563eb;
          color: white;
        }
        
        .react-datepicker__time-list-item:hover {
          background-color: #dbeafe;
          color: #1e40af;
        }
      `}</style>
    </div>
  );
};

export default CampaignManagement;