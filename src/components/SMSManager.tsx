import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  History,
  MessageSquare,
  Search,
  Send,
  TestTube,
  Users,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSMS } from "../hooks/useSMS";
import { useTemplates } from "../hooks/useTemplates";
import { useUsers } from "../hooks/useUsers";
import { supabase } from "../lib/supabase";

interface Campaign {
  id: string;
  name: string;
  description: string;
  type: "event" | "promotion";
  created_at: string;
  image_url?: string | null;
}

interface SendResult {
  success: boolean;
  error?: string;
  sentCount?: number;
  cost?: number;
  errors?: string[];
  invalidNumbers?: Array<{
    submitted_number: string;
    message: string;
  }>;
}

interface RecentSMSCampaign {
  id: string;
  type: string;
  recipient_count: number;
  sent_count: number;
  status: string;
  created_at: string;
  campaign_id?: string;
  campaigns?: {
    name: string;
  } | null;
}

interface RawSMSCampaign {
  id: string;
  type: string;
  recipient_count: number;
  sent_count: number;
  status: string;
  created_at: string;
  campaign_id?: string;
  campaigns?:
    | {
        name: string;
      }[]
    | null;
}

const SMSManager: React.FC = () => {
  const { t } = useTranslation();
  const { templates } = useTemplates();
  const { allUsers: users } = useUsers();
  const { sendSMS, testSMS, sending, progress } = useSMS();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sender] = useState("1511");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [recentSMSCampaigns, setRecentSMSCampaigns] = useState<
    RecentSMSCampaign[]
  >([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const campaignsPerPage = 10;

  // Fetch campaigns on component mount
  React.useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const { data, error } = await supabase
          .from("campaigns")
          .select("id, name, description, type, created_at, image_url")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCampaigns(data || []);
      } catch (error) {
        console.error("Error fetching campaigns:", error);
      }
    };

    fetchCampaigns();
  }, []);

  // Fetch recent SMS campaigns with pagination
  const fetchRecentSMSCampaigns = async (page: number = 1) => {
    try {
      setLoadingRecent(true);

      // First, get the total count
      const { count, error: countError } = await supabase
        .from("bulk_messages")
        .select("*", { count: "exact", head: true })
        .eq("type", "sms");

      if (countError) throw countError;

      const totalCount = count || 0;
      const totalPagesCalculated = Math.ceil(totalCount / campaignsPerPage);

      setTotalCampaigns(totalCount);
      setTotalPages(totalPagesCalculated);

      // Then fetch the paginated data
      const from = (page - 1) * campaignsPerPage;
      const to = from + campaignsPerPage - 1;

      const { data, error } = await supabase
        .from("bulk_messages")
        .select(
          `
          id,
          type,
          recipient_count,
          sent_count,
          status,
          created_at,
          campaign_id,
          campaigns(name)
        `
        )
        .eq("type", "sms")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData: RecentSMSCampaign[] = (data || []).map(
        (item: RawSMSCampaign) => ({
          id: item.id,
          type: item.type,
          recipient_count: item.recipient_count,
          sent_count: item.sent_count,
          status: item.status,
          created_at: item.created_at,
          campaign_id: item.campaign_id,
          campaigns:
            item.campaigns && item.campaigns.length > 0
              ? { name: item.campaigns[0].name }
              : null,
        })
      );

      setRecentSMSCampaigns(transformedData);
    } catch (error) {
      console.error("Error fetching recent SMS campaigns:", error);
    } finally {
      setLoadingRecent(false);
    }
  };

  React.useEffect(() => {
    fetchRecentSMSCampaigns(currentPage);
  }, [currentPage, sendResult]); // Refresh when page changes or a new SMS is sent

  const smsTemplates = templates.filter((t) => t.type === "sms");
  const activeUsersWithPhones = users.filter(
    (u) =>
      u.status === "active" &&
      u.phoneNumber &&
      u.phoneNumber.trim() &&
      u.phoneNumber !== "null" &&
      u.phoneNumber !== "undefined"
  );

  // Filter users based on search term
  const filteredUsersWithPhones = activeUsersWithPhones.filter((user) => {
    if (!userSearchTerm.trim()) return true;

    const searchLower = userSearchTerm.toLowerCase();
    const name = user.name || "";
    const phone = user.phoneNumber || "";
    const email = user.email || "";

    return (
      name.toLowerCase().includes(searchLower) ||
      phone.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower)
    );
  });

  const getRecipientCount = () => {
    switch (recipientFilter) {
      case "selected":
        return selectedUserIds.length;
      case "filtered":
        return filteredUsersWithPhones.length;
      default:
        return filteredUsersWithPhones.length;
    }
  };

  const recipientCount = getRecipientCount();

  // Helper function to generate campaign link placeholder
  const generateCampaignLinkPlaceholder = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return "";
    // Use campaign ID (first 8 characters) for unique identification
    const uniqueId = campaignId.substring(0, 8);
    return `{{ link_${uniqueId} }}`;
  };

  // Helper function to get all campaign link placeholders in the message
  const getCampaignLinkPlaceholders = (message: string) => {
    const regex = /\{\{\s*link_[a-zA-Z0-9]{8}\s*\}\}/g;
    return message.match(regex) || [];
  };

  const getCurrentMessage = () => {
    if (selectedTemplate) {
      const template = smsTemplates.find((t) => t.id === selectedTemplate);
      return template?.content || "";
    }
    return customMessage;
  };

  // Check if message contains special characters that require UCS-2 encoding
  const hasSpecialCharacters = (message: string) => {
    // First, remove all placeholders from the message to avoid false positives
    let messageWithoutPlaceholders = message;

    // Remove generic {{ link }} placeholder
    messageWithoutPlaceholders = messageWithoutPlaceholders.replace(
      /\{\{\s*link\s*\}\}/g,
      ""
    );

    // Remove campaign-specific {{ link_XXXXXXXX }} placeholders
    messageWithoutPlaceholders = messageWithoutPlaceholders.replace(
      /\{\{\s*link_[a-zA-Z0-9]{8}\s*\}\}/g,
      ""
    );

    // Remove opt-out link placeholder
    messageWithoutPlaceholders = messageWithoutPlaceholders.replace(
      /\[%opt_out_link%\]/g,
      ""
    );

    // Special symbols that trigger UCS-2 encoding
    const specialSymbols = /[\^{}[\]~\\|€]/;

    // Cyrillic characters (Bulgarian alphabet)
    const cyrillicChars = /[\u0400-\u04FF]/;

    return (
      specialSymbols.test(messageWithoutPlaceholders) ||
      cyrillicChars.test(messageWithoutPlaceholders)
    );
  };

  // Calculate SMS parts based on character encoding
  const calculateSMSParts = (length: number, hasSpecial: boolean) => {
    if (length === 0) return 0;

    if (hasSpecial) {
      // UCS-2 encoding limits (70 chars for 1 part, then 67 chars per additional part)
      if (length <= 70) return 1;
      return Math.ceil((length - 70) / 67) + 1;
    } else {
      // GSM 7-bit encoding limits (160 chars for 1 part, then 153 chars per additional part)
      if (length <= 160) return 1;
      return Math.ceil((length - 160) / 153) + 1;
    }
  };

  // Get maximum characters allowed for current part count
  const getMaxCharsForParts = (parts: number, hasSpecial: boolean) => {
    if (parts === 0) return 0;
    if (parts === 1) {
      return hasSpecial ? 70 : 160;
    }

    if (hasSpecial) {
      // UCS-2: 70 + (parts-1) * 67
      return 70 + (parts - 1) * 67;
    } else {
      // GSM: 160 + (parts-1) * 153
      return 160 + (parts - 1) * 153;
    }
  };

  // Calculate message length accounting for dynamic link replacement
  const getEffectiveMessageLength = () => {
    const message = getCurrentMessage();
    const campaignLinkPlaceholders = getCampaignLinkPlaceholders(message);
    const hasGenericLink = message.includes("{{ link }}");
    const hasOptOutLink = message.includes("[%opt_out_link%]");

    let effectiveLength = message.length;

    // Handle generic {{ link }} placeholder
    if (hasGenericLink) {
      const genericPlaceholderLength = "{{ link }}".length; // 10 characters
      const actualUrlLength = 19; // "www.cutme.bg/ABC123" = 19 characters
      effectiveLength -= genericPlaceholderLength;
      effectiveLength += actualUrlLength;
    }

    // Handle campaign-specific link placeholders
    campaignLinkPlaceholders.forEach((placeholder) => {
      const placeholderLength = placeholder.length; // e.g., "{{ link_12345678 }}" = 20 characters
      const actualUrlLength = 19; // "www.cutme.bg/ABC123" = 19 characters
      effectiveLength -= placeholderLength;
      effectiveLength += actualUrlLength;
    });

    // Handle opt-out link placeholder
    if (hasOptOutLink) {
      const optOutPlaceholderLength = "[%opt_out_link%]".length; // 16 characters
      const actualOptOutUrlLength = 19; // "www.cutme.bg/ABC123" = 19 characters (similar shortened URL)
      effectiveLength -= optOutPlaceholderLength;
      effectiveLength += actualOptOutUrlLength;
    }

    return effectiveLength;
  };

  // Handle campaign selection/deselection
  const handleCampaignSelection = (campaignId: string, checked: boolean) => {
    if (checked) {
      setSelectedCampaigns((prev) => [...prev, campaignId]);
    } else {
      setSelectedCampaigns((prev) => prev.filter((id) => id !== campaignId));
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds((prev) => [...prev, userId]);
    } else {
      setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleSelectAllUsers = () => {
    if (selectedUserIds.length === filteredUsersWithPhones.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsersWithPhones.map((u) => u.id));
    }
  };

  const handleSend = async () => {
    const message = getCurrentMessage();
    if (!message.trim() || recipientCount === 0) return;

    setSendResult(null);

    // Get recipient phone numbers based on selection
    let recipients: string[] = [];

    switch (recipientFilter) {
      case "selected":
        recipients = filteredUsersWithPhones
          .filter((user) => selectedUserIds.includes(user.id))
          .map((user) => user.phoneNumber)
          .filter(
            (phone) =>
              phone && phone.trim() && phone !== "null" && phone !== "undefined"
          );
        break;
      case "filtered":
        recipients = filteredUsersWithPhones
          .map((user) => user.phoneNumber)
          .filter(
            (phone) =>
              phone && phone.trim() && phone !== "null" && phone !== "undefined"
          );
        break;
      default: // 'all'
        recipients = filteredUsersWithPhones
          .map((user) => user.phoneNumber)
          .filter(
            (phone) =>
              phone && phone.trim() && phone !== "null" && phone !== "undefined"
          );
        break;
    }

    if (recipients.length === 0) {
      setSendResult({
        success: false,
        error: t("sms.noValidRecipients"),
      });
      return;
    }

    try {
      const smsFunction = isTestMode ? testSMS : sendSMS;
      const result = await smsFunction({
        recipients,
        message: message.trim(),
        sender: sender.trim() || "BulkComm",
        campaignId:
          selectedCampaigns.length > 0 ? selectedCampaigns[0] : undefined, // For backward compatibility, use first campaign
        campaignIds:
          selectedCampaigns.length > 0 ? selectedCampaigns : undefined, // New field for multiple campaigns
      });

      setSendResult(result);

      // Clear message if successful and not in test mode
      if (result.success && !isTestMode) {
        setSelectedTemplate("");
        setCustomMessage("");
        setSelectedCampaigns([]);
        // Reset to first page to see the new campaign
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("SMS sending error:", error);
      setSendResult({
        success: false,
        error: error instanceof Error ? error.message : t("sms.smsSendError"),
      });
    }
  };

  const messageLength = getCurrentMessage().length;
  const effectiveMessageLength = getEffectiveMessageLength();
  const currentMessage = getCurrentMessage();

  // Check for special characters after simulating link replacement
  let messageAfterLinkReplacement = currentMessage;
  // Replace generic {{ link }} placeholder with actual URL
  messageAfterLinkReplacement = messageAfterLinkReplacement.replace(
    /\{\{\s*link\s*\}\}/g,
    "www.cutme.bg/ABC123"
  );
  // Replace campaign-specific {{ link_XXXXXXXX }} placeholders with actual URL
  messageAfterLinkReplacement = messageAfterLinkReplacement.replace(
    /\{\{\s*link_[a-zA-Z0-9]{8}\s*\}\}/g,
    "www.cutme.bg/ABC123"
  );
  // Replace opt-out link placeholder with actual URL
  messageAfterLinkReplacement = messageAfterLinkReplacement.replace(
    /\[%opt_out_link%\]/g,
    "www.cutme.bg/ABC123"
  );

  const hasSpecial = hasSpecialCharacters(messageAfterLinkReplacement);
  const smsCount = calculateSMSParts(effectiveMessageLength, hasSpecial);
  const maxCharsForCurrentParts = getMaxCharsForParts(smsCount, hasSpecial);

  // Calculate remaining characters until next SMS part
  const getRemainingChars = () => {
    if (effectiveMessageLength === 0) return hasSpecial ? 70 : 160;

    if (hasSpecial) {
      // UCS-2 encoding: 70 chars for 1st part, 67 chars for each additional part
      if (effectiveMessageLength <= 70) {
        return 70 - effectiveMessageLength;
      } else {
        // Calculate which part we're in and remaining chars in current part
        const charsAfterFirst = effectiveMessageLength - 70;
        const additionalParts = Math.ceil(charsAfterFirst / 67);
        const maxCharsInCurrentPart = 70 + additionalParts * 67;
        return maxCharsInCurrentPart - effectiveMessageLength;
      }
    } else {
      // GSM 7-bit encoding: 160 chars for 1st part, 153 chars for each additional part
      if (effectiveMessageLength <= 160) {
        return 160 - effectiveMessageLength;
      } else {
        // Calculate which part we're in and remaining chars in current part
        const charsAfterFirst = effectiveMessageLength - 160;
        const additionalParts = Math.ceil(charsAfterFirst / 153);
        const maxCharsInCurrentPart = 160 + additionalParts * 153;
        return maxCharsInCurrentPart - effectiveMessageLength;
      }
    }
  };

  const remainingChars = getRemainingChars();
  const estimatedCost = (recipientCount * 0.1).toFixed(2);

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
          {t("sms.title")}
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setIsTestMode(!isTestMode)}
            className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
              isTestMode
                ? "bg-yellow-600 text-white hover:bg-yellow-700"
                : "bg-gray-600 text-white hover:bg-gray-700"
            }`}
          >
            <TestTube className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">
              {isTestMode ? t("sms.testModeOn") : t("sms.testModeOff")}
            </span>
            <span className="sm:hidden">
              {isTestMode ? t("sms.testOn") : t("sms.testOff")}
            </span>
          </button>
        </div>
      </div>

      {/* Test Mode Notice */}
      {isTestMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start">
            <TestTube className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900">
                {t("sms.testModeActive")}
              </h4>
              <p className="text-sm text-yellow-800 mt-1">
                {t("sms.testModeDescription")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Message Composer */}
        <div className="xl:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              {t("sms.composeSms")}
            </h3>

            {/* Campaign Selection - Multi-select */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("sms.linkToCampaign")}
              </label>

              {/* Selected Campaigns Display */}
              {selectedCampaigns.length > 0 && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    {t("sms.selectedCampaigns", {
                      count: selectedCampaigns.length,
                    })}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaigns.map((campaignId) => {
                      const campaign = campaigns.find(
                        (c) => c.id === campaignId
                      );
                      if (!campaign) return null;

                      return (
                        <div
                          key={campaignId}
                          className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-blue-300 text-sm"
                        >
                          {campaign.image_url && (
                            <img
                              src={campaign.image_url}
                              alt="campaign"
                              className="w-6 h-6 object-cover rounded"
                              loading="lazy"
                            />
                          )}
                          <span className="font-medium">{campaign.name}</span>
                          <button
                            onClick={() =>
                              handleCampaignSelection(campaignId, false)
                            }
                            className="text-red-600 hover:text-red-800 ml-1"
                            title={t("sms.removeCampaign")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Campaign Selection List */}
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    {t("sms.availableCampaigns", {
                      remaining: campaigns.length - selectedCampaigns.length,
                    })}
                  </span>
                </div>
                <div className="p-2 space-y-1">
                  {campaigns.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-600">
                        {t("sms.noCampaignsAvailable")}
                      </p>
                    </div>
                  ) : (
                    campaigns
                      .filter(
                        (campaign) => !selectedCampaigns.includes(campaign.id)
                      )
                      .map((campaign) => (
                        <label
                          key={campaign.id}
                          className="flex items-center p-3 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.includes(campaign.id)}
                            onChange={(e) =>
                              handleCampaignSelection(
                                campaign.id,
                                e.target.checked
                              )
                            }
                            className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                          />
                          <div className="flex items-center gap-3 overflow-hidden flex-1">
                            <span className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                              {campaign.image_url ? (
                                <img
                                  src={campaign.image_url}
                                  alt="campaign"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                                  {t("sms.noImage")}
                                </div>
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {campaign.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {campaign.type} •{" "}
                                {new Date(
                                  campaign.created_at
                                ).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))
                  )}
                </div>
              </div>
            </div>

            {/* Message Input */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedTemplate ? t("sms.templatePreview") : t("sms.message")}
              </label>

              {/* Campaign Link Tags */}
              {!selectedTemplate && selectedCampaigns.length > 0 && (
                <div className="mb-3">
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600 block mb-2">
                      {t("sms.campaignLinkTags")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedCampaigns.map((campaignId) => {
                        const campaign = campaigns.find(
                          (c) => c.id === campaignId
                        );
                        if (!campaign) return null;

                        const placeholder =
                          generateCampaignLinkPlaceholder(campaignId);

                        return (
                          <div
                            key={campaignId}
                            draggable
                            className="px-3 py-2 bg-green-100 text-green-800 text-sm font-mono rounded-lg border-2 border-dashed border-green-300 cursor-move hover:bg-green-200 transition-colors select-none flex items-center gap-2"
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", placeholder);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            title={`Drag to insert ${campaign.name} link`}
                          >
                            {campaign.image_url && (
                              <img
                                src={campaign.image_url}
                                alt="campaign"
                                className="w-4 h-4 object-cover rounded"
                                loading="lazy"
                              />
                            )}
                            {placeholder}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t("sms.campaignLinkTagsInstructions")}
                  </p>
                </div>
              )}

              {/* Default Tags (Always Available) */}
              {!selectedTemplate && (
                <div className="mb-3">
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600 block mb-2">
                      {t("sms.defaultTags")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <div
                        draggable
                        className="px-3 py-2 bg-blue-100 text-blue-800 text-sm font-mono rounded-lg border-2 border-dashed border-blue-300 cursor-move hover:bg-blue-200 transition-colors select-none flex items-center gap-2"
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "text/plain",
                            "[%opt_out_link%]"
                          );
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        title={t("sms.optOutTagTitle")}
                      >
                        [%opt_out_link%]
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t("sms.defaultTagsInstructions")}
                  </p>
                </div>
              )}

              <textarea
                value={getCurrentMessage()}
                onChange={(e) =>
                  !selectedTemplate && setCustomMessage(e.target.value)
                }
                onDrop={(e) => {
                  e.preventDefault();
                  if (selectedTemplate) return;

                  const linkTag = e.dataTransfer.getData("text/plain");
                  // Support campaign-specific placeholders and opt-out links
                  if (
                    linkTag.match(/\{\{\s*link_[a-zA-Z0-9]{8}\s*\}\}/) ||
                    linkTag === "[%opt_out_link%]"
                  ) {
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const newMessage =
                      customMessage.substring(0, start) +
                      linkTag +
                      customMessage.substring(end);
                    setCustomMessage(newMessage);

                    // Set cursor position after the inserted tag
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(
                        start + linkTag.length,
                        start + linkTag.length
                      );
                    }, 0);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!selectedTemplate) {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.backgroundColor = "#f0f9ff";
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.backgroundColor = "white";
                }}
                placeholder={t("sms.messagePlaceholder")}
                rows={4}
                disabled={!!selectedTemplate}
                className="w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-sm sm:text-base resize-y transition-colors"
              />
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 gap-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {t("sms.charactersCount", { length: messageLength })}
                    </span>
                    {hasSpecial && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                        {t("sms.specialCharsDetected")}
                      </span>
                    )}
                  </div>
                  {messageLength !== effectiveMessageLength && (
                    <span className="text-xs text-blue-600">
                      {t("sms.effectiveLength", {
                        length: effectiveMessageLength,
                        linkCount:
                          getCampaignLinkPlaceholders(getCurrentMessage())
                            .length +
                          (getCurrentMessage().includes("{{ link }}") ? 1 : 0) +
                          (getCurrentMessage().includes("[%opt_out_link%]")
                            ? 1
                            : 0),
                      })}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-xs ${
                      effectiveMessageLength > maxCharsForCurrentParts
                        ? "text-red-600"
                        : effectiveMessageLength > (hasSpecial ? 70 : 160)
                        ? "text-orange-600"
                        : "text-gray-500"
                    }`}
                  >
                    {t("sms.smsPartsWithRemaining", {
                      count: smsCount,
                      remaining: remainingChars,
                      hasSpecial: hasSpecial,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Variables */}
            {selectedTemplate && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  {t("sms.availableVariables")}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {smsTemplates
                    .find((t) => t.id === selectedTemplate)
                    ?.variables.map((variable) => (
                      <span
                        key={variable}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                      >
                        {`{{${variable}}}`}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Recipient Selection */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("sms.recipients")}
              </label>
              <div className="space-y-3">
                <div className="flex items-start">
                  <input
                    type="radio"
                    id="all-users"
                    name="recipients"
                    value="all"
                    checked={recipientFilter === "all"}
                    onChange={(e) => setRecipientFilter(e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <label
                    htmlFor="all-users"
                    className="text-sm text-gray-700 flex-1"
                  >
                    {t("sms.allActiveUsers", {
                      count: filteredUsersWithPhones.length,
                    })}
                  </label>
                </div>
                <div className="flex items-start">
                  <input
                    type="radio"
                    id="selected-users"
                    name="recipients"
                    value="selected"
                    checked={recipientFilter === "selected"}
                    onChange={(e) => setRecipientFilter(e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <label
                    htmlFor="selected-users"
                    className="text-sm text-gray-700 flex-1"
                  >
                    {t("sms.selectedUsers", { count: selectedUserIds.length })}
                  </label>
                </div>
              </div>

              {/* User Selection List */}
              {recipientFilter === "selected" && (
                <div className="mt-4 border border-gray-200 rounded-lg">
                  {/* Search Input */}
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder={t("sms.searchUsersPlaceholder")}
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {userSearchTerm && (
                        <button
                          onClick={() => setUserSearchTerm("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {userSearchTerm && (
                      <p className="text-xs text-gray-600 mt-1">
                        {t("sms.foundUsersMatching", {
                          count: filteredUsersWithPhones.length,
                          searchTerm: userSearchTerm,
                        })}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {t("sms.selectUsers")}
                    </span>
                    <button
                      onClick={handleSelectAllUsers}
                      className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded self-start sm:self-auto"
                    >
                      {selectedUserIds.length === filteredUsersWithPhones.length
                        ? t("users.deselectAll")
                        : t("users.selectAll", {
                            count: filteredUsersWithPhones.length,
                          })}
                    </button>
                  </div>
                  <div className="p-2 space-y-1 max-h-48 sm:max-h-64 overflow-y-auto">
                    {filteredUsersWithPhones.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {userSearchTerm
                            ? t("sms.noUsersFound")
                            : t("sms.noUsersAvailable")}
                        </p>
                      </div>
                    ) : (
                      filteredUsersWithPhones.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center p-2 sm:p-3 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={(e) =>
                              handleUserSelection(user.id, e.target.checked)
                            }
                            className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {user.name || t("users.noName")}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {user.phoneNumber}
                              {user.email && (
                                <span className="ml-2">• {user.email}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={
                sending ||
                !getCurrentMessage().trim() ||
                recipientCount === 0 ||
                effectiveMessageLength === 0
              }
              className={`w-full inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base ${
                isTestMode
                  ? "bg-yellow-600 text-white hover:bg-yellow-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span className="hidden sm:inline">
                    {isTestMode
                      ? t("sms.testingSms", { progress })
                      : t("sms.sendingSms", { progress })}
                  </span>
                  <span className="sm:hidden">
                    {isTestMode
                      ? t("sms.testing", { progress })
                      : t("sms.sending", { progress })}
                  </span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    {isTestMode
                      ? t("sms.testSms", { count: recipientCount })
                      : t("sms.sendSms", { count: recipientCount })}
                  </span>
                  <span className="sm:hidden">
                    {isTestMode
                      ? t("sms.test", { count: recipientCount })
                      : t("sms.send", { count: recipientCount })}
                  </span>
                </>
              )}
            </button>

            {/* Progress Bar */}
            {sending && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isTestMode ? "bg-yellow-600" : "bg-blue-600"
                    }`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Send Result */}
            {sendResult && (
              <div
                className={`mt-4 p-3 sm:p-4 rounded-lg ${
                  sendResult.success
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <div className="flex items-start">
                  {sendResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-medium ${
                        sendResult.success ? "text-green-900" : "text-red-900"
                      }`}
                    >
                      {sendResult.success
                        ? isTestMode
                          ? t("sms.smsTestSuccessful")
                          : t("sms.smsSentSuccessfully")
                        : t("sms.smsSendingFailed")}
                    </h4>
                    {/* <p
                      className={`text-sm mt-1 ${
                        sendResult.success ? "text-green-800" : "text-red-800"
                      }`}
                    >
                      {sendResult.success
                        ? `${
                            isTestMode
                              ? t("sms.testValidated")
                              : t("sms.successfullySent")
                          } ${sendResult.sentCount || recipientCount} ${t(
                            "sms.smsPartsCount",
                            { count: sendResult.sentCount || recipientCount }
                          )}${
                            sendResult.cost
                              ? ` ${t("sms.costInfo", {
                                  cost: sendResult.cost.toFixed(4),
                                })}`
                              : ""
                          }.`
                        : sendResult.error || t("sms.smsSendError")}
                    </p> */}
                    {sendResult.errors && sendResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-red-700 font-medium">
                          {t("sms.individualErrors")}
                        </p>
                        <ul className="text-xs text-red-600 mt-1 max-h-20 overflow-y-auto">
                          {sendResult.errors
                            .slice(0, 5)
                            .map((error: string, index: number) => (
                              <li key={index}>• {error}</li>
                            ))}
                          {sendResult.errors.length > 5 && (
                            <li>
                              •{" "}
                              {t("sms.moreErrors", {
                                count: sendResult.errors.length - 5,
                              })}
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {sendResult.invalidNumbers &&
                      sendResult.invalidNumbers.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-red-700 font-medium">
                            {t("sms.invalidNumbers")}
                          </p>
                          <ul className="text-xs text-red-600 mt-1">
                            {sendResult.invalidNumbers.map(
                              (invalid, index: number) => (
                                <li key={index}>
                                  • {invalid.submitted_number}:{" "}
                                  {invalid.message}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              {t("sms.smsStats")}
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm text-gray-600">
                    {t("sms.recipients")}
                  </span>
                </div>
                <span className="font-semibold text-gray-900">
                  {recipientCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 text-purple-600 mr-2" />
                  <span className="text-sm text-gray-600">
                    {t("sms.estimatedCost")}
                  </span>
                </div>
                <span className="font-semibold text-gray-900">
                  {t("sms.costAmount", { cost: estimatedCost })}
                </span>
              </div>
            </div>
          </div>

          {/* SMS Guidelines */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              {t("sms.smsBestPractices")}
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• {t("sms.keepUnder160")}</li>
              <li>• {t("sms.includeOptOut")}</li>
              <li>• {t("sms.personalizeVariables")}</li>
              <li>• {t("sms.testBeforeSend")}</li>
              <li>• {t("sms.monitorDelivery")}</li>
              <li>• {t("sms.clearSender")}</li>
              <li>• {t("sms.respectTimeZones")}</li>
              <li>• {t("sms.complyRegulations")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent SMS Campaigns */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex items-center">
            <History className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              {t("sms.recentSmsCampaigns")}
            </h3>
            {totalCampaigns > 0 && (
              <span className="ml-2 text-sm text-gray-500">
                ({t("sms.totalCampaigns", { count: totalCampaigns })})
              </span>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("sms.previousPage")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-sm text-gray-600 min-w-0">
                {t("sms.pageInfo", { current: currentPage, total: totalPages })}
              </span>

              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("sms.nextPage")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {loadingRecent ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-gray-600">{t("sms.loadingRecent")}</span>
          </div>
        ) : recentSMSCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {t("sms.noSmsCampaigns")}
            </h4>
            <p className="text-gray-600">{t("sms.noSmsCampaignsSubtitle")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <div className="overflow-hidden">
                {/* Mobile-first responsive table */}
                <div className="block lg:hidden">
                  <div className="space-y-4">
                    {recentSMSCampaigns.map((campaign) => {
                      const unsuccessful =
                        campaign.recipient_count - campaign.sent_count;
                      const successRate =
                        campaign.recipient_count > 0
                          ? (
                              (campaign.sent_count / campaign.recipient_count) *
                              100
                            ).toFixed(1)
                          : "0";

                      return (
                        <div
                          key={campaign.id}
                          className="bg-gray-50 rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 break-words">
                                {campaign.campaign_id &&
                                campaign.campaigns?.name
                                  ? campaign.campaigns.name
                                  : t("sms.directSms")}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(
                                  campaign.created_at
                                ).toLocaleDateString()}{" "}
                                • {t("sms.successRate", { rate: successRate })}
                              </p>
                            </div>
                            <span
                              className={`ml-3 inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                                campaign.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : campaign.status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : campaign.status === "sending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {campaign.status === "completed"
                                ? t("sms.completed")
                                : campaign.status === "failed"
                                ? t("sms.failed")
                                : campaign.status === "sending"
                                ? t("sms.sendingStatus")
                                : campaign.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-lg font-semibold text-gray-900">
                                {campaign.recipient_count.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {t("sms.sent")}
                              </div>
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-green-600">
                                {campaign.sent_count.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {t("sms.successful")} ({successRate}%)
                              </div>
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-red-600">
                                {unsuccessful.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {t("sms.unsuccessful")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop table */}
                <table className="hidden lg:table min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("sms.campaignName")}
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("sms.sent")}
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("sms.successful")}
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("sms.unsuccessful")}
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("sms.status")}
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("sms.date")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentSMSCampaigns.map((campaign) => {
                      const unsuccessful =
                        campaign.recipient_count - campaign.sent_count;
                      const successRate =
                        campaign.recipient_count > 0
                          ? (
                              (campaign.sent_count / campaign.recipient_count) *
                              100
                            ).toFixed(1)
                          : "0";

                      return (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-3 sm:py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900 break-words">
                                {campaign.campaign_id &&
                                campaign.campaigns?.name
                                  ? campaign.campaigns.name
                                  : t("sms.directSms")}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-4">
                            <div className="text-sm text-gray-900 font-medium">
                              {campaign.recipient_count.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-4">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-green-600">
                                {campaign.sent_count.toLocaleString()}
                              </div>
                              <div className="ml-2 text-xs text-gray-500">
                                ({successRate}%)
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-4">
                            <div className="text-sm font-medium text-red-600">
                              {unsuccessful.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                campaign.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : campaign.status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : campaign.status === "sending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {campaign.status === "completed"
                                ? t("sms.completed")
                                : campaign.status === "failed"
                                ? t("sms.failed")
                                : campaign.status === "sending"
                                ? t("sms.sendingStatus")
                                : campaign.status}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-gray-500">
                            <div>
                              <div>
                                {new Date(
                                  campaign.created_at
                                ).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(
                                  campaign.created_at
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SMSManager;
