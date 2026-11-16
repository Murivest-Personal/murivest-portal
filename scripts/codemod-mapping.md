# Codemod mapping — Prisma model -> Supabase table (sql/ DDL, snake_case)

All tables live in the `portal` schema (schema-qualified DDL).
Supabase client is created with `db: {schema: 'portal'}` — see src/lib/supabase.ts.
Postgres functions callable via `.rpc()` from sql/003_functions.sql: create_admin, purge_expired, most_viewed_opportunities, investor_activity.

## User  ->  `users`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| email | email | TEXT | — |
| passwordHash | password_hash | TEXT | — |
| fullName | full_name | TEXT | — |
| role | role | portal.user_role | 'investor' |
| status | status | portal.account_status | 'active' |
| emailVerifiedAt | email_verified_at | TIMESTAMPTZ | — |
| mfaEnabled | mfa_enabled | BOOLEAN | FALSE |
| mfaSecretEnc | mfa_secret_enc | TEXT | — |
| lastLoginAt | last_login_at | TIMESTAMPTZ | — |
| failedLogins | failed_logins | INTEGER | 0 |
| lockedUntil | locked_until | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## Session  ->  `sessions`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| tokenHash | token_hash | TEXT | — |
| userAgent | user_agent | TEXT | — |
| ip | ip | INET | — |
| device | device | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| lastSeenAt | last_seen_at | TIMESTAMPTZ | now() |
| expiresAt | expires_at | TIMESTAMPTZ | — |
| revokedAt | revoked_at | TIMESTAMPTZ | — |

## AuthToken  ->  `auth_tokens`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| tokenHash | token_hash | TEXT | — |
| purpose | purpose | portal.token_purpose | — |
| expiresAt | expires_at | TIMESTAMPTZ | — |
| usedAt | used_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## SecurityEvent  ->  `security_events`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| type | type | portal.security_event_type | — |
| ip | ip | INET | — |
| userAgent | user_agent | TEXT | — |
| detail | detail | JSONB | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## Organisation  ->  `organisations`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| name | name | TEXT | — |
| legalName | legal_name | TEXT | — |
| type | type | portal.org_type | 'institution' |
| country | country | TEXT | — |
| website | website | TEXT | — |
| verified | verified | BOOLEAN | FALSE |
| createdById | created_by_id | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## OrganisationMember  ->  `organisation_members`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| organisationId | organisation_id | TEXT | — |
| userId | user_id | TEXT | — |
| role | role | portal.org_member_role | 'member' |
| title | title | TEXT | — |
| status | status | portal.org_member_status | 'invited' |
| createdAt | created_at | TIMESTAMPTZ | now() |

## InvestorProfile  ->  `investor_profiles`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| classification | classification | portal.classification | 'individual' |
| organisationId | organisation_id | TEXT | — |
| jobTitle | job_title | TEXT | — |
| nationality | nationality | TEXT | — |
| countryResidence | country_residence | TEXT | — |
| phone | phone | TEXT | — |
| capitalCurrency | capital_currency | TEXT | 'USD' |
| equityAvailable | equity_available | NUMERIC(18,2) | — |
| totalCapacity | total_capacity | NUMERIC(18,2) | — |
| capitalFloor | capital_floor | NUMERIC(18,2) | — |
| capitalCeiling | capital_ceiling | NUMERIC(18,2) | — |
| verificationStatus | verification_status | portal.verification_status | 'unverified' |
| kycStatus | kyc_status | portal.kyc_status | 'not_started' |
| amlStatus | aml_status | portal.aml_status | 'not_started' |
| accessTier | access_tier | portal.access_tier | 'tier_1' |
| ndaAccepted | nda_accepted | BOOLEAN | FALSE |
| onboardingStep | onboarding_step | INTEGER | 1 |
| advisorId | advisor_id | TEXT | — |
| source | source | TEXT | — |
| notes | notes | TEXT | — |
| preferences | preferences | JSONB | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## InvestorCriteria  ->  `investor_criteria`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| currency | currency | TEXT | 'USD' |
| equityAvailable | equity_available | NUMERIC(18,2) | — |
| totalCapacity | total_capacity | NUMERIC(18,2) | — |
| minTicket | min_ticket | NUMERIC(18,2) | — |
| maxTicket | max_ticket | NUMERIC(18,2) | — |
| geographies | geographies | JSONB | — |
| assetClasses | asset_classes | JSONB | — |
| structures | structures | JSONB | — |
| minGrossYield | min_gross_yield | NUMERIC(6,4) | — |
| minNetYield | min_net_yield | NUMERIC(6,4) | — |
| targetIrr | target_irr | NUMERIC(6,4) | — |
| targetCashOnCash | target_cash_on_cash | NUMERIC(6,4) | — |
| targetPaybackYears | target_payback_years | NUMERIC(6,2) | — |
| holdPeriodMin | hold_period_min | NUMERIC(6,2) | — |
| holdPeriodMax | hold_period_max | NUMERIC(6,2) | — |
| leverageComfort | leverage_comfort | NUMERIC(5,2) | — |
| financingOpen | financing_open | BOOLEAN | TRUE |
| riskTolerance | risk_tolerance | portal.risk_tolerance | — |
| exitPreferences | exit_preferences | JSONB | — |
| currencyNote | currency_note | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## SavedOpportunity  ->  `saved_opportunities`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| sanityId | sanity_id | TEXT | — |
| note | note | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## OpportunityView  ->  `opportunity_views`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| sanityId | sanity_id | TEXT | — |
| viewedAt | viewed_at | TIMESTAMPTZ | now() |

## SavedSearch  ->  `saved_searches`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| name | name | TEXT | — |
| filters | filters | JSONB | — |
| alertOnNew | alert_on_new | BOOLEAN | FALSE |
| lastAlertAt | last_alert_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## Scenario  ->  `scenarios`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| name | name | TEXT | — |
| sanityOpportunityId | sanity_opportunity_id | TEXT | — |
| opportunityTitle | opportunity_title | TEXT | — |
| inputs | inputs | JSONB | — |
| summary | summary | JSONB | — |
| notes | notes | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## Comparison  ->  `comparisons`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| name | name | TEXT | — |
| sanityIds | sanity_ids | JSONB | '[]'::jsonb |
| scenarioIds | scenario_ids | JSONB | '[]'::jsonb |
| snapshot | snapshot | JSONB | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## Order  ->  `orders`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| reference | reference | TEXT | — |
| userId | user_id | TEXT | — |
| briefSource | brief_source | portal.order_source | 'catalog' |
| sanityBriefId | sanity_brief_id | TEXT | — |
| sanityOpportunityId | sanity_opportunity_id | TEXT | — |
| briefTitle | brief_title | TEXT | — |
| briefType | brief_type | portal.order_type | 'private_brief' |
| format | format | portal.order_format | 'digital' |
| customScope | custom_scope | TEXT | — |
| amountKes | amount_kes | NUMERIC(18,2) | 0 |
| amountUsd | amount_usd | NUMERIC(18,2) | 0 |
| currency | currency | TEXT | 'KES' |
| status | status | portal.order_status | 'pending' |
| paymentMethod | payment_method | portal.payment_method | — |
| transactionId | transaction_id | TEXT | — |
| assignedToId | assigned_to_id | TEXT | — |
| advisorId | advisor_id | TEXT | — |
| priority | priority | portal.order_priority | 'normal' |
| dueAt | due_at | TIMESTAMPTZ | — |
| deliveryDocumentId | delivery_document_id | TEXT | — |
| contactName | contact_name | TEXT | — |
| contactEmail | contact_email | TEXT | — |
| organisation | organisation | TEXT | — |
| shippingAddress | shipping_address | TEXT | — |
| phone | phone | TEXT | — |
| deliveryMethod | delivery_method | TEXT | — |
| trackingNumber | tracking_number | TEXT | — |
| cancelledAt | cancelled_at | TIMESTAMPTZ | — |
| cancellationReason | cancellation_reason | TEXT | — |
| deliveredAt | delivered_at | TIMESTAMPTZ | — |
| closedAt | closed_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## Payment  ->  `payments`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| orderId | order_id | TEXT | — |
| userId | user_id | TEXT | — |
| method | method | portal.payment_method | — |
| amountKes | amount_kes | NUMERIC(18,2) | 0 |
| amountUsd | amount_usd | NUMERIC(18,2) | 0 |
| currency | currency | TEXT | 'KES' |
| reference | reference | TEXT | — |
| confirmationRaw | confirmation_raw | TEXT | — |
| status | status | portal.payment_status | 'submitted' |
| verifiedById | verified_by_id | TEXT | — |
| verifiedAt | verified_at | TIMESTAMPTZ | — |
| note | note | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## Mandate  ->  `mandates`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| reference | reference | TEXT | — |
| userId | user_id | TEXT | — |
| title | title | TEXT | — |
| status | status | portal.mandate_status | 'draft' |
| description | description | TEXT | — |
| targetAllocationMin | target_allocation_min | NUMERIC(18,2) | — |
| targetAllocationMax | target_allocation_max | NUMERIC(18,2) | — |
| currency | currency | TEXT | 'USD' |
| geographies | geographies | JSONB | — |
| assetClasses | asset_classes | JSONB | — |
| structures | structures | JSONB | — |
| minNetYield | min_net_yield | NUMERIC(6,4) | — |
| targetIrr | target_irr | NUMERIC(6,4) | — |
| holdPeriodMin | hold_period_min | NUMERIC(6,2) | — |
| holdPeriodMax | hold_period_max | NUMERIC(6,2) | — |
| leverageComfort | leverage_comfort | NUMERIC(5,2) | — |
| riskMandate | risk_mandate | portal.risk_tolerance | — |
| exclusions | exclusions | JSONB | — |
| advisorId | advisor_id | TEXT | — |
| stage | stage | portal.mandate_stage | 'sourcing' |
| probability | probability | INTEGER | 0 |
| nextAction | next_action | TEXT | — |
| nextActionDue | next_action_due | TIMESTAMPTZ | — |
| submittedAt | submitted_at | TIMESTAMPTZ | — |
| activatedAt | activated_at | TIMESTAMPTZ | — |
| closedAt | closed_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## MandateMilestone  ->  `mandate_milestones`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| mandateId | mandate_id | TEXT | — |
| title | title | TEXT | — |
| detail | detail | TEXT | — |
| dueDate | due_date | TIMESTAMPTZ | — |
| status | status | portal.milestone_status | 'pending' |
| completedAt | completed_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## Enquiry  ->  `enquiries`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| subject | subject | TEXT | — |
| message | message | TEXT | — |
| sanityOpportunityId | sanity_opportunity_id | TEXT | — |
| opportunityTitle | opportunity_title | TEXT | — |
| status | status | portal.enquiry_status | 'open' |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## Message  ->  `messages`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| senderType | sender_type | portal.message_sender | 'investor' |
| senderId | sender_id | TEXT | — |
| enquiryId | enquiry_id | TEXT | — |
| body | body | TEXT | — |
| readAt | read_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## Notification  ->  `notifications`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| category | category | portal.notification_category | 'system' |
| event | event | TEXT | — |
| type | type | portal.notification_type | — |
| priority | priority | portal.notification_priority | 'normal' |
| title | title | TEXT | — |
| body | body | TEXT | — |
| link | link | TEXT | — |
| payload | payload | JSONB | — |
| dedupeKey | dedupe_key | TEXT | — |
| announcementId | announcement_id | TEXT | — |
| readAt | read_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## NotificationSetting  ->  `notification_settings`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| globalEnabled | global_enabled | BOOLEAN | TRUE |
| quietStartMin | quiet_start_min | INTEGER | — |
| quietEndMin | quiet_end_min | INTEGER | — |
| digestEnabled | digest_enabled | BOOLEAN | FALSE |
| digestFrequency | digest_frequency | portal.digest_frequency | 'weekly' |
| emailSuppressed | email_suppressed | BOOLEAN | FALSE |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## NotificationPreference  ->  `notification_preferences`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| channel | channel | portal.notification_channel | — |
| category | category | portal.notification_category | — |
| enabled | enabled | BOOLEAN | TRUE |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## PushSubscription  ->  `push_subscriptions`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| endpoint | endpoint | TEXT | — |
| p256dh | p256dh | TEXT | — |
| auth | auth | TEXT | — |
| platform | platform | TEXT | 'desktop' |
| userAgent | user_agent | TEXT | — |
| deviceLabel | device_label | TEXT | — |
| lastSeenAt | last_seen_at | TIMESTAMPTZ | now() |
| revokedAt | revoked_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## NotificationDelivery  ->  `notification_deliveries`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| notificationId | notification_id | TEXT | — |
| channel | channel | portal.notification_channel | — |
| status | status | portal.notification_delivery_status | 'sent' |
| address | address | TEXT | — |
| detail | detail | TEXT | — |
| messageId | message_id | TEXT | — |
| sentAt | sent_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## EmailTemplate  ->  `email_templates`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| key | key | TEXT | — |
| category | category | portal.notification_category | — |
| subject | subject | TEXT | — |
| preheader | preheader | TEXT | — |
| bodyHtml | body_html | TEXT | — |
| bodyText | body_text | TEXT | — |
| isActive | is_active | BOOLEAN | TRUE |
| version | version | INTEGER | 1 |
| updatedById | updated_by_id | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## EmailTemplateVersion  ->  `email_template_versions`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| templateId | template_id | TEXT | — |
| version | version | INTEGER | — |
| subject | subject | TEXT | — |
| preheader | preheader | TEXT | — |
| bodyHtml | body_html | TEXT | — |
| bodyText | body_text | TEXT | — |
| savedById | saved_by_id | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## NotificationAnnouncement  ->  `notification_announcements`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| title | title | TEXT | — |
| body | body | TEXT | — |
| link | link | TEXT | — |
| category | category | portal.notification_category | 'system' |
| priority | priority | portal.notification_priority | 'high' |
| audience | audience | JSONB | — |
| createdById | created_by_id | TEXT | — |
| recipientCount | recipient_count | INTEGER | 0 |
| sentAt | sent_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## DocumentGrant  ->  `document_grants`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| sanityDocumentId | sanity_document_id | TEXT | — |
| userId | user_id | TEXT | — |
| organisationId | organisation_id | TEXT | — |
| grantedById | granted_by_id | TEXT | — |
| permission | permission | portal.doc_permission | 'view' |
| expiresAt | expires_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## DocumentAccessLog  ->  `document_access_logs`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| sanityDocumentId | sanity_document_id | TEXT | — |
| documentTitle | document_title | TEXT | — |
| action | action | portal.doc_access_action | — |
| ip | ip | INET | — |
| userAgent | user_agent | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## DocumentRequest  ->  `document_requests`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| subject | subject | TEXT | — |
| detail | detail | TEXT | — |
| sanityOpportunityId | sanity_opportunity_id | TEXT | — |
| type | type | portal.doc_request_type | 'data_room' |
| status | status | portal.doc_request_status | 'submitted' |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## NdaAgreement  ->  `nda_agreements`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| version | version | TEXT | — |
| ip | ip | INET | — |
| userAgent | user_agent | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## PortfolioPosition  ->  `portfolio_positions`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| name | name | TEXT | — |
| sanityOpportunityId | sanity_opportunity_id | TEXT | — |
| assetClass | asset_class | TEXT | — |
| geography | geography | TEXT | — |
| status | status | portal.position_status | 'committed' |
| acquisitionDate | acquisition_date | TIMESTAMPTZ | — |
| purchasePrice | purchase_price | NUMERIC(18,2) | — |
| currency | currency | TEXT | 'USD' |
| equityDeployed | equity_deployed | NUMERIC(18,2) | — |
| debtAmount | debt_amount | NUMERIC(18,2) | — |
| debtRate | debt_rate | NUMERIC(6,4) | — |
| debtMaturity | debt_maturity | TIMESTAMPTZ | — |
| grossIncomeAnnual | gross_income_annual | NUMERIC(18,2) | — |
| operatingExpenses | operating_expenses | NUMERIC(18,2) | — |
| noiActual | noi_actual | NUMERIC(18,2) | — |
| occupancyPct | occupancy_pct | NUMERIC(5,2) | — |
| valuation | valuation | NUMERIC(18,2) | — |
| valuationDate | valuation_date | TIMESTAMPTZ | — |
| valuationBasis | valuation_basis | TEXT | — |
| notes | notes | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## CapitalCall  ->  `capital_calls`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| positionId | position_id | TEXT | — |
| label | label | TEXT | — |
| amount | amount | NUMERIC(18,2) | — |
| currency | currency | TEXT | 'USD' |
| dueDate | due_date | TIMESTAMPTZ | — |
| status | status | portal.capital_call_status | 'scheduled' |
| calledAt | called_at | TIMESTAMPTZ | — |
| paidAt | paid_at | TIMESTAMPTZ | — |
| notes | notes | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## StaffProfile  ->  `staff_profiles`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| userId | user_id | TEXT | — |
| adminRole | admin_role | portal.admin_role | 'advisor' |
| title | title | TEXT | — |
| team | team | TEXT | — |
| isActive | is_active | BOOLEAN | TRUE |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## OrderStatusEvent  ->  `order_status_events`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| orderId | order_id | TEXT | — |
| fromStatus | from_status | portal.order_status | — |
| toStatus | to_status | portal.order_status | — |
| changedById | changed_by_id | TEXT | — |
| note | note | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## RevenueEvent  ->  `revenue_events`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| orderId | order_id | TEXT | — |
| grossKes | gross_kes | NUMERIC(18,2) | 0 |
| grossUsd | gross_usd | NUMERIC(18,2) | 0 |
| processingUsd | processing_usd | NUMERIC(18,2) | 0 |
| refundUsd | refund_usd | NUMERIC(18,2) | 0 |
| netUsd | net_usd | NUMERIC(18,2) | 0 |
| recognisedAt | recognised_at | TIMESTAMPTZ | now() |
| recognisedById | recognised_by_id | TEXT | — |
| note | note | TEXT | — |

## RefundAdjustment  ->  `refund_adjustments`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| orderId | order_id | TEXT | — |
| amountUsd | amount_usd | NUMERIC(18,2) | — |
| amountKes | amount_kes | NUMERIC(18,2) | 0 |
| reason | reason | TEXT | — |
| status | status | portal.refund_status | 'proposed' |
| requestedById | requested_by_id | TEXT | — |
| reviewedById | reviewed_by_id | TEXT | — |
| reviewedAt | reviewed_at | TIMESTAMPTZ | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## ComplianceReview  ->  `compliance_reviews`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| subjectUserId | subject_user_id | TEXT | — |
| reviewerId | reviewer_id | TEXT | — |
| decision | decision | portal.review_decision | — |
| notes | notes | TEXT | — |
| riskFlags | risk_flags | JSONB | — |
| detail | detail | JSONB | — |
| createdAt | created_at | TIMESTAMPTZ | now() |

## InternalNote  ->  `internal_notes`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| entityType | entity_type | TEXT | — |
| entityId | entity_id | TEXT | — |
| authorId | author_id | TEXT | — |
| body | body | TEXT | — |
| visibility | visibility | portal.note_visibility | 'staff' |
| createdAt | created_at | TIMESTAMPTZ | now() |

## ContentMeta  ->  `content_meta`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| contentType | content_type | portal.content_type | — |
| sanityId | sanity_id | TEXT | — |
| title | title | TEXT | — |
| tags | tags | JSONB | — |
| status | status | portal.content_status | 'live' |
| featured | featured | BOOLEAN | FALSE |
| visibilityTier | visibility_tier | portal.access_tier | 'tier_1' |
| notes | notes | TEXT | — |
| updatedById | updated_by_id | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## SystemSetting  ->  `system_settings`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| key | key | TEXT | — |
| category | category | portal.setting_category | 'general' |
| value | value | JSONB | — |
| description | description | TEXT | — |
| updatedById | updated_by_id | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
| updatedAt | updated_at | TIMESTAMPTZ | now() |

## AuditLog  ->  `logs`
| Prisma field | DB column | SQL type | default |
| --- | --- | --- | --- |
| id | id | TEXT | — |
| actorId | actor_id | TEXT | — |
| actorType | actor_type | portal.actor_type | 'user' |
| action | action | TEXT | — |
| entity | entity | TEXT | — |
| entityId | entity_id | TEXT | — |
| detail | detail | JSONB | — |
| ip | ip | INET | — |
| userAgent | user_agent | TEXT | — |
| createdAt | created_at | TIMESTAMPTZ | now() |
