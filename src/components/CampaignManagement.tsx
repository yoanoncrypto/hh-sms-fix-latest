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
  Upload,
  Save,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Campaign } from "../types";
import { generateShortId } from "../utils/shortId";
import { useStorageUpload } from "../hooks/useStorageUpload";
import LocationMapPicker from "./LocationMapPicker";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Link } from "react-router-dom";

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
  const [copied, setCopied] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

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
    isActive: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);

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
      isActive: false,
    });
    setFormErrors({});
    setEditingCampaign(null);
    setUploadedImageFile(null);
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
    if (!formData.imageUrl.trim() && !uploadedImageFile) {
      errors.image = t("campaigns.imageRequiredError");
    }
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
      let finalImageUrl = formData.imageUrl;

      // Upload image if file is selected
      if (uploadedImageFile) {
        const uploadedUrl = await uploadFile(uploadedImageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          setFormErrors({ image: "Failed to upload image" });
          return;
        }
      }

      // Set end date to start date if not provided
      const finalEndDate = formData.endDate || formData.date;

      const campaignData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        image_url: finalImageUrl || null,
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
        // Create new campaign
        const shortId = generateShortId();
        const { error } = await supabase
          .from("campaigns")
          .insert({
            ...campaignData,
            short_id: shortId,
          });

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      fetchCampaigns();
    } catch (err) {
      setFormErrors({
        submit: err instanceof Error ? err.message : "Failed to save campaign",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
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
    setFormErrors({});
    setShowModal(true);
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
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

      setShowDeleteModal(false);
      setDeletingCampaign(null);
      fetchCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingCampaign(null);
  };

  const copyPublicLink = async (campaign: Campaign) => {
    const publicUrl = `${window.location.origin}/c/${campaign.short_id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(campaign.id);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImageFile(file);
      setFormData((prev) => ({ ...prev, imageUrl: "" })); // Clear manual URL when file is selected
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
        <p className="text-red-800">{t("error")}: {error}</p>
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
          onClick={openCreateModal}
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
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ fontSize: "16px" }}
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
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredCampaigns.length === 1
                ? t("campaigns.foundResults", {
                    count: filteredCampaigns.length,
                    searchTerm,
                  })
                : t("campaigns.foundResults_plural", {
                    count: filteredCampaigns.length,
                    searchTerm,
                  })}
            </p>
            <button
              onClick={() => setSearchTerm("")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("campaigns.clearSearch")}
            </button>
          </div>
        )}
      </div>

      {/* Campaigns Grid */}
      {paginatedCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? t("campaigns.noResults") : t("campaigns.noCampaigns")}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm
              ? t("campaigns.noResultsSubtitle")
              : t("campaigns.noCampaignsSubtitle")}
          </p>
          {!searchTerm && (
            <button
              onClick={openCreateModal}
              className="mobile-button bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("campaigns.createNew")}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
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
                  <div className="absolute top-2 right-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        campaign.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {campaign.is_active ? "Active" : "Inactive"}
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
                          {new Date(campaign.date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {campaign.location && (
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="line-clamp-1">{campaign.location}</span>
                      </div>
                    )}
                    {campaign.rsvp_enabled && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="h-4 w-4 mr-2" />
                        <span>RSVP Required</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/campaigns/${campaign.id}`}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
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
                        {copied === campaign.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={`/c/${campaign.short_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-gray-800 p-1"
                        title="Open public link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
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
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("previous")}
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg ${
                          currentPage === pageNum
                            ? "bg-blue-600 text-white"
                            : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingCampaign
                    ? t("campaigns.editCampaign")
                    : t("campaigns.createCampaign")}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
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
                        style={{ fontSize: "16px" }}
                      />
                      {formErrors.name && (
                        <p className="text-sm text-red-600 mt-1">
                          {formErrors.name}
                        </p>
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
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows={4}
                        className={`mobile-input ${
                          formErrors.description ? "border-red-300" : ""
                        }`}
                        style={{ fontSize: "16px" }}
                      />
                      {formErrors.description && (
                        <p className="text-sm text-red-600 mt-1">
                          {formErrors.description}
                        </p>
                      )}
                    </div>

                    {/* Campaign Type */}
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
                        style={{ fontSize: "16px" }}
                      >
                        <option value="">{t("campaigns.selectType")}</option>
                        <option value="event">{t("campaigns.event")}</option>
                        <option value="promotion">
                          {t("campaigns.promotion")}
                        </option>
                      </select>
                      {formErrors.type && (
                        <p className="text-sm text-red-600 mt-1">
                          {formErrors.type}
                        </p>
                      )}
                    </div>

                    {/* Is Active Toggle */}
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              isActive: e.target.checked,
                            })
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Campaign is Active
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Only active campaigns will be visible to the public
                      </p>
                    </div>

                    {/* Start Date & Time */}
                    {formData.type === "event" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date & Time *
                        </label>
                        <DatePicker
                          selected={formData.date}
                          onChange={(date) =>
                            setFormData({ ...formData, date })
                          }
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="MMMM d, yyyy h:mm aa"
                          className={`mobile-input ${
                            formErrors.date ? "border-red-300" : ""
                          }`}
                          placeholderText="Select start date and time"
                          minDate={new Date()}
                          style={{ fontSize: "16px" }}
                        />
                        {formErrors.date && (
                          <p className="text-sm text-red-600 mt-1">
                            {formErrors.date}
                          </p>
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
                          onChange={(date) =>
                            setFormData({ ...formData, endDate: date })
                          }
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="MMMM d, yyyy h:mm aa"
                          className="mobile-input"
                          placeholderText="Select end date and time (defaults to start date)"
                          minDate={formData.date || new Date()}
                          style={{ fontSize: "16px" }}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          If not specified, will default to the start date & time
                        </p>
                      </div>
                    )}

                    {/* Location Name */}
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
                            setFormData({
                              ...formData,
                              location: e.target.value,
                            })
                          }
                          placeholder={t("campaigns.locationPlaceholder")}
                          className={`mobile-input ${
                            formErrors.location ? "border-red-300" : ""
                          }`}
                          style={{ fontSize: "16px" }}
                        />
                        {formErrors.location && (
                          <p className="text-sm text-red-600 mt-1">
                            {formErrors.location}
                          </p>
                        )}
                      </div>
                    )}

                    {/* RSVP Toggle */}
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.rsvpEnabled}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rsvpEnabled: e.target.checked,
                            })
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {t("campaigns.enableRsvp")}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
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
                                onChange={handleImageUpload}
                              />
                            </label>
                            <p className="mt-1 text-xs text-gray-500">
                              {t("campaigns.imageFormats")}
                            </p>
                          </div>
                        </div>

                        {uploadedImageFile && (
                          <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-900">
                                {uploadState.uploading
                                  ? t("campaigns.uploadingImage")
                                  : `Selected: ${uploadedImageFile.name}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedImageFile(null);
                                  clearUpload();
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {uploadState.error && (
                          <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-sm text-red-800">
                              {uploadState.error}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Manual URL Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t("campaigns.enterImageUrl")}
                        </label>
                        <input
                          type="url"
                          value={formData.imageUrl}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              imageUrl: e.target.value,
                            })
                          }
                          placeholder="https://example.com/image.jpg"
                          className="mobile-input"
                          style={{ fontSize: "16px" }}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t("campaigns.imageUrlOverride")}
                        </p>
                      </div>

                      {formErrors.image && (
                        <p className="text-sm text-red-600 mt-1">
                          {formErrors.image}
                        </p>
                      )}
                    </div>

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
                  </div>
                </div>

                {/* Submit Error */}
                {formErrors.submit && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{formErrors.submit}</p>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 mobile-button bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || uploadState.uploading}
                    className="flex-1 mobile-button justify-center bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {editingCampaign
                          ? t("sms.updateCampaign")
                          : t("sms.createCampaign")}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editingCampaign
                          ? t("sms.updateCampaign")
                          : t("sms.createCampaign")}
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
    </div>
  );
};

export default CampaignManagement;