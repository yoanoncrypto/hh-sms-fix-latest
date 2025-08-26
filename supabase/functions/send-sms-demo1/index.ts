import { createClient } from "npm:@supabase/supabase-js@2.39.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    const {
      recipients,
      message,
      sender = "BulkComm",
      test = false,
      campaignId,
      campaignIds, // New field for multiple campaigns
    } = await req.json();
    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Recipients array is required and cannot be empty",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Message content is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Initialize Supabase client with service role key for full database access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicBaseUrl =
      Deno.env.get("PUBLIC_BASE_URL") || "https://your-domain.com";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Supabase configuration missing",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Check if message contains link placeholders
    const hasGenericLinkPlaceholder = message.includes("{{ link }}");
    const campaignLinkPlaceholders =
      message.match(/\{\{\s*link_[a-zA-Z0-9]{8}\s*\}\}/g) || [];
    const hasCampaignLinkPlaceholders = campaignLinkPlaceholders.length > 0;
    const hasAnyLinkPlaceholder =
      hasGenericLinkPlaceholder || hasCampaignLinkPlaceholders;

    // Determine which campaigns to process
    const campaignsToProcess = [];
    if (campaignIds && Array.isArray(campaignIds) && campaignIds.length > 0) {
      campaignsToProcess.push(...campaignIds);
    } else if (campaignId) {
      campaignsToProcess.push(campaignId);
    }

    // Extract campaign IDs from placeholders and add them to campaignsToProcess
    const dynamicCampaignIds = [];
    if (hasCampaignLinkPlaceholders) {
      for (const placeholder of campaignLinkPlaceholders) {
        const match = placeholder.match(/\{\{\s*link_([a-zA-Z0-9]{8})\s*\}\}/);
        if (match) {
          const partialId = match[1];

          // Find campaign by partial ID
          const { data: matchingCampaigns, error: campaignError } =
            await supabase
              .from("campaigns")
              .select("id")
              .ilike("id", `${partialId}%`)
              .limit(1);

          if (
            !campaignError &&
            matchingCampaigns &&
            matchingCampaigns.length > 0
          ) {
            const fullCampaignId = matchingCampaigns[0].id;
            if (!campaignsToProcess.includes(fullCampaignId)) {
              campaignsToProcess.push(fullCampaignId);
              dynamicCampaignIds.push(fullCampaignId);
            }
          }
        }
      }
    }

    // Fetch campaign data for all campaigns that need processing
    const campaignDataMap = new Map(); // campaignId -> { short_id, name }
    if (campaignsToProcess.length > 0 && hasAnyLinkPlaceholder) {
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, short_id, name")
        .in("id", campaignsToProcess);

      if (campaignsError) {
        console.error("Failed to fetch campaigns data:", campaignsError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to fetch campaigns data",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Create a map for quick lookup
      campaignsData.forEach((campaign) => {
        campaignDataMap.set(campaign.id, {
          short_id: campaign.short_id,
          name: campaign.name,
        });
      });
    }
    // Process all recipients to handle user creation and campaign recipient management
    const processedRecipients = [];
    const errors = [];
    // Helper function to detect country from phone number
    const detectCountryFromPhone = (phone) => {
      const prefixes = {
        "+359": "BG",
        "+380": "UA",
        "+48": "PL",
        "+40": "RO",
        "+36": "HU",
        "+420": "CZ",
        "+421": "SK",
        "+385": "HR",
        "+386": "SI",
        "+381": "RS",
        "+49": "DE",
        "+33": "FR",
        "+39": "IT",
        "+34": "ES",
        "+31": "NL",
        "+32": "BE",
        "+43": "AT",
        "+41": "CH",
        "+44": "GB",
        "+1": "US",
      };
      for (const [prefix, country] of Object.entries(prefixes)) {
        if (phone.startsWith(prefix)) {
          return country;
        }
      }
      return "Unknown";
    };
    // Step 1: Get all existing users in a single query
    const { data: existingUsers, error: usersError } = await supabase
      .from("users")
      .select("id, phone_number")
      .in("phone_number", recipients);
    if (usersError) {
      console.error("Failed to fetch existing users:", usersError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch existing users from database",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    const existingUserMap = new Map(
      existingUsers.map((u) => [u.phone_number, u.id])
    );
    // Step 2: Identify new users that need to be created
    const newUsers = recipients
      .filter((phone) => !existingUserMap.has(phone))
      .map((phone) => ({
        phone_number: phone,
        country: detectCountryFromPhone(phone),
        status: "active",
      }));
    // Step 3: Batch insert new users if any
    let newUserMap = new Map();
    if (newUsers.length > 0) {
      const { data: insertedUsers, error: insertError } = await supabase
        .from("users")
        .insert(newUsers)
        .select("id, phone_number");
      if (insertError) {
        console.error("Failed to insert new users:", insertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create new users in database",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
      newUserMap = new Map(insertedUsers.map((u) => [u.phone_number, u.id]));
    }
    // Step 4: Create user ID mapping for all recipients
    const userIdMap = new Map();
    for (const phone of recipients) {
      const userId = existingUserMap.get(phone) || newUserMap.get(phone);
      if (userId) {
        userIdMap.set(phone, userId);
      }
    }
    // Step 5: Handle campaign recipients for all campaigns
    const campaignRecipientMaps = new Map(); // campaignId -> Map(phone -> unique_token)

    for (const campaignIdToProcess of campaignsToProcess) {
      // Get existing campaign recipients for this campaign and all user IDs
      const userIds = Array.from(userIdMap.values());
      const { data: existingRecipients, error: recipientsError } =
        await supabase
          .from("campaign_recipients")
          .select("user_id, unique_token")
          .eq("campaign_id", campaignIdToProcess)
          .in("user_id", userIds);

      if (recipientsError) {
        console.error(
          `Failed to fetch existing campaign recipients for campaign ${campaignIdToProcess}:`,
          recipientsError
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to fetch existing campaign recipients",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const existingRecipientMap = new Map(
        existingRecipients.map((r) => [r.user_id, r.unique_token])
      );

      // Identify new campaign recipients that need to be created
      const newCampaignRecipients = [];
      const recipientTokenMap = new Map(); // phone -> unique_token

      for (const phone of recipients) {
        const userId = userIdMap.get(phone);
        if (!userId) continue;
        const existingToken = existingRecipientMap.get(userId);
        if (existingToken) {
          // Use existing token
          recipientTokenMap.set(phone, existingToken);
        } else {
          // Generate new token for new recipient
          const uniqueToken = Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();
          recipientTokenMap.set(phone, uniqueToken);
          newCampaignRecipients.push({
            campaign_id: campaignIdToProcess,
            user_id: userId,
            status: "sent",
            unique_token: uniqueToken,
          });
        }
      }

      // Batch insert new campaign recipients
      if (newCampaignRecipients.length > 0) {
        const { error: insertRecipientsError } = await supabase
          .from("campaign_recipients")
          .insert(newCampaignRecipients);
        if (insertRecipientsError) {
          console.error(
            `Failed to insert campaign recipients for campaign ${campaignIdToProcess}:`,
            insertRecipientsError
          );
          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to create campaign recipients",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }
      }

      // Update existing campaign recipients status to 'sent'
      const existingUserIds = Array.from(existingRecipientMap.keys());
      if (existingUserIds.length > 0) {
        const { error: updateError } = await supabase
          .from("campaign_recipients")
          .update({
            status: "sent",
          })
          .eq("campaign_id", campaignIdToProcess)
          .in("user_id", existingUserIds);
        if (updateError) {
          console.error(
            `Failed to update existing campaign recipients for campaign ${campaignIdToProcess}:`,
            updateError
          );
          // Don't fail the entire operation for this, just log it
        }
      }

      campaignRecipientMaps.set(campaignIdToProcess, recipientTokenMap);
    }
    // Step 6: Generate personalized links for each recipient
    const personalizedLinksMap = new Map(); // phone -> Map(placeholder -> url)

    if (hasAnyLinkPlaceholder) {
      for (const phone of recipients) {
        const recipientLinks = new Map(); // placeholder -> url

        // Handle generic {{ link }} placeholder
        if (hasGenericLinkPlaceholder) {
          // Use the first campaign for generic links (backward compatibility)
          const firstCampaignId = campaignsToProcess[0];
          if (firstCampaignId) {
            const campaignData = campaignDataMap.get(firstCampaignId);
            const recipientMap = campaignRecipientMaps.get(firstCampaignId);

            if (campaignData && recipientMap && recipientMap.has(phone)) {
              const token = recipientMap.get(phone);
              // Use /{token} format for direct token access
              recipientLinks.set("{{ link }}", `${publicBaseUrl}/${token}`);
            } else {
              recipientLinks.set("{{ link }}", publicBaseUrl);
            }
          } else {
            recipientLinks.set("{{ link }}", publicBaseUrl);
          }
        }

        // Handle campaign-specific placeholders
        for (const placeholder of campaignLinkPlaceholders) {
          // Extract campaign ID from placeholder (first 8 characters after "link_")
          const match = placeholder.match(
            /\{\{\s*link_([a-zA-Z0-9]{8})\s*\}\}/
          );
          if (match) {
            const partialId = match[1];

            // Find the full campaign ID that starts with this partial ID
            let foundCampaignId = null;
            for (const campaignId of campaignsToProcess) {
              if (campaignId.startsWith(partialId)) {
                foundCampaignId = campaignId;
                break;
              }
            }

            if (foundCampaignId) {
              const recipientMap = campaignRecipientMaps.get(foundCampaignId);

              if (recipientMap && recipientMap.has(phone)) {
                const token = recipientMap.get(phone);
                // Use /{token} format for direct token access
                recipientLinks.set(placeholder, `${publicBaseUrl}/${token}`);
              } else {
                recipientLinks.set(placeholder, publicBaseUrl);
              }
            } else {
              recipientLinks.set(placeholder, publicBaseUrl);
            }
          }
        }

        personalizedLinksMap.set(phone, recipientLinks);
      }
    }
    // Step 7: Prepare message for SMS API
    let finalMessage = message.trim();

    if (hasAnyLinkPlaceholder && personalizedLinksMap.size > 0) {
      // For SMSAPI.bg, we need to replace placeholders with [%cutme:actual_url%]
      // The SMSAPI will automatically shorten these URLs to cutme.bg format

      // Create a map of placeholder to URL for each recipient
      const placeholderToUrlMap = new Map();

      // Get the first recipient's links as template (all recipients get the same placeholders)
      const firstRecipientLinks = personalizedLinksMap.get(recipients[0]);
      if (firstRecipientLinks) {
        for (const [placeholder, url] of firstRecipientLinks) {
          placeholderToUrlMap.set(placeholder, url);
        }
      }

      // Replace placeholders with [%cutme:actual_url%] format
      finalMessage = finalMessage.replace(/\{\{\s*link\s*\}\}/g, (match) => {
        const url = placeholderToUrlMap.get(match);
        return url ? `[%cutme:${url}%]` : match;
      });

      finalMessage = finalMessage.replace(
        /\{\{\s*link_[a-zA-Z0-9]{8}\s*\}\}/g,
        (match) => {
          const url = placeholderToUrlMap.get(match);
          return url ? `[%cutme:${url}%]` : match;
        }
      );
    }
    // Step 8: Get SMSAPI credentials and send SMS
    const SMSAPI_TOKEN = Deno.env.get("SMSAPI_TOKEN");
    if (!SMSAPI_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SMSAPI token not configured",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Prepare SMS API request
    const smsApiUrl = "https://api.smsapi.bg/sms.do";
    const recipientsString = recipients.join(",");
    const formData = new URLSearchParams();
    formData.append("to", recipientsString);
    formData.append("message", finalMessage);
    formData.append("from", sender);
    formData.append("format", "json");
    formData.append("encoding", "utf-8");
    if (test) {
      formData.append("test", "1");
    }
    // Send SMS via SMSAPI.bg
    const smsResponse = await fetch(smsApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SMSAPI_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const responseText = await smsResponse.text();
    let smsData;
    try {
      smsData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse SMSAPI response:", responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid response from SMS provider",
          details: responseText,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Step 9: Handle SMS API errors
    if (smsData.error) {
      const errorMessages = {
        11: "Message too long or contains invalid characters",
        13: "No valid phone numbers provided",
        14: "Invalid sender name",
        101: "Invalid authorization",
        103: "Insufficient credits",
        105: "IP address not allowed",
        112: "Sending to this country is restricted",
        203: "Too many requests, please try again later",
      };
      // Log failed bulk message
      if (!test) {
        await supabase.from("bulk_messages").insert({
          type: "sms",
          content: message,
          recipient_count: recipients.length,
          sent_count: 0,
          status: "failed",
          completed_at: new Date().toISOString(),
          campaign_id: campaignId || null,
        });
      }
      return new Response(
        JSON.stringify({
          success: false,
          error:
            errorMessages[smsData.error] ||
            `SMS API Error: ${smsData.message || smsData.error}`,
          errorCode: smsData.error,
          invalidNumbers: smsData.invalid_numbers || [],
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Step 10: Process successful SMS response
    const sentCount = smsData.count || 0;
    const messageIds = smsData.list?.map((item) => item.id) || [];
    const totalCost =
      smsData.list?.reduce((sum, item) => sum + item.points, 0) || 0;
    // Step 11: Update campaign recipient statuses based on SMS API response
    if (campaignsToProcess.length > 0 && smsData.list) {
      const successfulNumbers = new Set(
        smsData.list.map((item) => item.number)
      );

      // Update successful recipients for all campaigns
      if (successfulNumbers.size > 0) {
        const successfulUserIds = recipients
          .filter((phone) => successfulNumbers.has(phone))
          .map((phone) => userIdMap.get(phone))
          .filter(Boolean);

        if (successfulUserIds.length > 0) {
          for (const campaignIdToProcess of campaignsToProcess) {
            await supabase
              .from("campaign_recipients")
              .update({
                status: "sent",
              })
              .eq("campaign_id", campaignIdToProcess)
              .in("user_id", successfulUserIds);
          }
        }
      }
      // Note: We don't update failed recipients to 'failed' status as they might be retried
      // The 'sent' status in campaign_recipients indicates the SMS was successfully queued/sent
    }
    // Step 12: Log successful bulk message (only if not test mode)
    if (!test) {
      const { error: logError } = await supabase.from("bulk_messages").insert({
        type: "sms",
        content: message,
        recipient_count: recipients.length,
        sent_count: sentCount,
        status: sentCount > 0 ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        campaign_id:
          campaignsToProcess.length > 0 ? campaignsToProcess[0] : null, // Log first campaign for backward compatibility
        // TODO: Add support for logging multiple campaigns in bulk_messages table
      });
      if (logError) {
        console.error("Failed to log bulk message:", logError);
        // Don't fail the entire operation for logging issues
      }
    }
    // Step 13: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        totalRecipients: recipients.length,
        messageIds,
        cost: totalCost,
        currency: "EUR",
        invalidNumbers: smsData.invalid_numbers || [],
        details: {
          sent: smsData.list || [],
          invalid: smsData.invalid_numbers || [],
          errors: errors.length > 0 ? errors : undefined,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("SMS sending error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        details: {
          type: "internal_error",
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
