# Table reference — Supabase DDL (sql/), as used by src/lib/supabase.ts

All tables live in the `portal` schema; audit rows in `audit` (audit.logs).
The client is created with `db: {schema: 'portal'}`; audit writes go through `auditTable()`.

## User  ->  `users`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| email | TEXT | — |
| password_hash | TEXT | — |
| full_name | TEXT | — |
| role | portal.user_role | 'investor' |
| status | portal.account_status | 'active' |
| email_verified_at | TIMESTAMPTZ | — |
| mfa_enabled | BOOLEAN | FALSE |
| mfa_secret_enc | TEXT | — |
| last_login_at | TIMESTAMPTZ | — |
| failed_logins | INTEGER | 0 |
| locked_until | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## Session  ->  `sessions`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| token_hash | TEXT | — |
| user_agent | TEXT | — |
| ip | INET | — |
| device | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| last_seen_at | TIMESTAMPTZ | now() |
| expires_at | TIMESTAMPTZ | — |
| revoked_at | TIMESTAMPTZ | — |

## AuthToken  ->  `auth_tokens`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| token_hash | TEXT | — |
| purpose | portal.token_purpose | — |
| expires_at | TIMESTAMPTZ | — |
| used_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## SecurityEvent  ->  `security_events`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| type | portal.security_event_type | — |
| ip | INET | — |
| user_agent | TEXT | — |
| detail | JSONB | — |
| created_at | TIMESTAMPTZ | now() |

## Organisation  ->  `organisations`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| name | TEXT | — |
| legal_name | TEXT | — |
| type | portal.org_type | 'institution' |
| country | TEXT | — |
| website | TEXT | — |
| verified | BOOLEAN | FALSE |
| created_by_id | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## OrganisationMember  ->  `organisation_members`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| organisation_id | TEXT | — |
| user_id | TEXT | — |
| role | portal.org_member_role | 'member' |
| title | TEXT | — |
| status | portal.org_member_status | 'invited' |
| created_at | TIMESTAMPTZ | now() |

## InvestorProfile  ->  `investor_profiles`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| classification | portal.classification | 'individual' |
| organisation_id | TEXT | — |
| job_title | TEXT | — |
| nationality | TEXT | — |
| country_residence | TEXT | — |
| phone | TEXT | — |
| capital_currency | TEXT | 'USD' |
| equity_available | NUMERIC(18,2) | — |
| total_capacity | NUMERIC(18,2) | — |
| capital_floor | NUMERIC(18,2) | — |
| capital_ceiling | NUMERIC(18,2) | — |
| verification_status | portal.verification_status | 'unverified' |
| kyc_status | portal.kyc_status | 'not_started' |
| aml_status | portal.aml_status | 'not_started' |
| access_tier | portal.access_tier | 'tier_1' |
| nda_accepted | BOOLEAN | FALSE |
| onboarding_step | INTEGER | 1 |
| advisor_id | TEXT | — |
| source | TEXT | — |
| notes | TEXT | — |
| preferences | JSONB | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## InvestorCriteria  ->  `investor_criteria`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| currency | TEXT | 'USD' |
| equity_available | NUMERIC(18,2) | — |
| total_capacity | NUMERIC(18,2) | — |
| min_ticket | NUMERIC(18,2) | — |
| max_ticket | NUMERIC(18,2) | — |
| geographies | JSONB | — |
| asset_classes | JSONB | — |
| structures | JSONB | — |
| min_gross_yield | NUMERIC(6,4) | — |
| min_net_yield | NUMERIC(6,4) | — |
| target_irr | NUMERIC(6,4) | — |
| target_cash_on_cash | NUMERIC(6,4) | — |
| target_payback_years | NUMERIC(6,2) | — |
| hold_period_min | NUMERIC(6,2) | — |
| hold_period_max | NUMERIC(6,2) | — |
| leverage_comfort | NUMERIC(5,2) | — |
| financing_open | BOOLEAN | TRUE |
| risk_tolerance | portal.risk_tolerance | — |
| exit_preferences | JSONB | — |
| currency_note | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## SavedOpportunity  ->  `saved_opportunities`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| sanity_id | TEXT | — |
| note | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## OpportunityView  ->  `opportunity_views`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| sanity_id | TEXT | — |
| viewed_at | TIMESTAMPTZ | now() |

## SavedSearch  ->  `saved_searches`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| name | TEXT | — |
| filters | JSONB | — |
| alert_on_new | BOOLEAN | FALSE |
| last_alert_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## Scenario  ->  `scenarios`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| name | TEXT | — |
| sanity_opportunity_id | TEXT | — |
| opportunity_title | TEXT | — |
| inputs | JSONB | — |
| summary | JSONB | — |
| notes | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## Comparison  ->  `comparisons`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| name | TEXT | — |
| sanity_ids | JSONB | '[]'::jsonb |
| scenario_ids | JSONB | '[]'::jsonb |
| snapshot | JSONB | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## Order  ->  `orders`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| reference | TEXT | — |
| user_id | TEXT | — |
| brief_source | portal.order_source | 'catalog' |
| sanity_brief_id | TEXT | — |
| sanity_opportunity_id | TEXT | — |
| brief_title | TEXT | — |
| brief_type | portal.order_type | 'private_brief' |
| format | portal.order_format | 'digital' |
| custom_scope | TEXT | — |
| amount_kes | NUMERIC(18,2) | 0 |
| amount_usd | NUMERIC(18,2) | 0 |
| currency | TEXT | 'KES' |
| status | portal.order_status | 'pending' |
| payment_method | portal.payment_method | — |
| transaction_id | TEXT | — |
| contact_name | TEXT | — |
| contact_email | TEXT | — |
| organisation | TEXT | — |
| shipping_address | TEXT | — |
| phone | TEXT | — |
| delivery_method | TEXT | — |
| tracking_number | TEXT | — |
| cancelled_at | TIMESTAMPTZ | — |
| cancellation_reason | TEXT | — |
| delivered_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |
| assigned_to_id | TEXT | — |
| advisor_id | TEXT | — |
| priority | portal.order_priority | 'normal' |
| due_at | TIMESTAMPTZ | — |
| delivery_document_id | TEXT | — |
| closed_at | TIMESTAMPTZ | — |

## Payment  ->  `payments`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| order_id | TEXT | — |
| user_id | TEXT | — |
| method | portal.payment_method | — |
| amount_kes | NUMERIC(18,2) | 0 |
| amount_usd | NUMERIC(18,2) | 0 |
| currency | TEXT | 'KES' |
| reference | TEXT | — |
| confirmation_raw | TEXT | — |
| status | portal.payment_status | 'submitted' |
| verified_by_id | TEXT | — |
| verified_at | TIMESTAMPTZ | — |
| note | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## Mandate  ->  `mandates`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| reference | TEXT | — |
| user_id | TEXT | — |
| title | TEXT | — |
| status | portal.mandate_status | 'draft' |
| description | TEXT | — |
| target_allocation_min | NUMERIC(18,2) | — |
| target_allocation_max | NUMERIC(18,2) | — |
| currency | TEXT | 'USD' |
| geographies | JSONB | — |
| asset_classes | JSONB | — |
| structures | JSONB | — |
| min_net_yield | NUMERIC(6,4) | — |
| target_irr | NUMERIC(6,4) | — |
| hold_period_min | NUMERIC(6,2) | — |
| hold_period_max | NUMERIC(6,2) | — |
| leverage_comfort | NUMERIC(5,2) | — |
| risk_mandate | portal.risk_tolerance | — |
| exclusions | JSONB | — |
| advisor_id | TEXT | — |
| submitted_at | TIMESTAMPTZ | — |
| activated_at | TIMESTAMPTZ | — |
| closed_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |
| stage | portal.mandate_stage | 'sourcing' |
| probability | INTEGER | 0 |
| next_action | TEXT | — |
| next_action_due | TIMESTAMPTZ | — |

## MandateMilestone  ->  `mandate_milestones`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| mandate_id | TEXT | — |
| title | TEXT | — |
| detail | TEXT | — |
| due_date | TIMESTAMPTZ | — |
| status | portal.milestone_status | 'pending' |
| completed_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## Enquiry  ->  `enquiries`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| subject | TEXT | — |
| message | TEXT | — |
| sanity_opportunity_id | TEXT | — |
| opportunity_title | TEXT | — |
| status | portal.enquiry_status | 'open' |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## Message  ->  `messages`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| sender_type | portal.message_sender | 'investor' |
| sender_id | TEXT | — |
| enquiry_id | TEXT | — |
| body | TEXT | — |
| read_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## Notification  ->  `notifications`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| type | portal.notification_type | — |
| title | TEXT | — |
| body | TEXT | — |
| link | TEXT | — |
| read_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |
| category | portal.notification_category | 'system' |
| event | TEXT | — |
| priority | portal.notification_priority | 'normal' |
| payload | JSONB | — |
| dedupe_key | TEXT | — |
| announcement_id | TEXT | — |
| updated_at | TIMESTAMPTZ | now() |

## NotificationSetting  ->  `notification_settings`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| global_enabled | BOOLEAN | TRUE |
| quiet_start_min | INTEGER | — |
| quiet_end_min | INTEGER | — |
| digest_enabled | BOOLEAN | FALSE |
| digest_frequency | portal.digest_frequency | 'weekly' |
| email_suppressed | BOOLEAN | FALSE |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## NotificationPreference  ->  `notification_preferences`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| channel | portal.notification_channel | — |
| category | portal.notification_category | — |
| enabled | BOOLEAN | TRUE |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## PushSubscription  ->  `push_subscriptions`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| endpoint | TEXT | — |
| p256dh | TEXT | — |
| auth | TEXT | — |
| platform | TEXT | 'desktop' |
| user_agent | TEXT | — |
| device_label | TEXT | — |
| last_seen_at | TIMESTAMPTZ | now() |
| revoked_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## NotificationDelivery  ->  `notification_deliveries`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| notification_id | TEXT | — |
| channel | portal.notification_channel | — |
| status | portal.notification_delivery_status | 'sent' |
| address | TEXT | — |
| detail | TEXT | — |
| message_id | TEXT | — |
| sent_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## EmailTemplate  ->  `email_templates`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| key | TEXT | — |
| category | portal.notification_category | — |
| subject | TEXT | — |
| preheader | TEXT | — |
| body_html | TEXT | — |
| body_text | TEXT | — |
| is_active | BOOLEAN | TRUE |
| version | INTEGER | 1 |
| updated_by_id | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## EmailTemplateVersion  ->  `email_template_versions`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| template_id | TEXT | — |
| version | INTEGER | — |
| subject | TEXT | — |
| preheader | TEXT | — |
| body_html | TEXT | — |
| body_text | TEXT | — |
| saved_by_id | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## NotificationAnnouncement  ->  `notification_announcements`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| title | TEXT | — |
| body | TEXT | — |
| link | TEXT | — |
| category | portal.notification_category | 'system' |
| priority | portal.notification_priority | 'high' |
| audience | JSONB | — |
| created_by_id | TEXT | — |
| recipient_count | INTEGER | 0 |
| sent_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## DocumentGrant  ->  `document_grants`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| sanity_document_id | TEXT | — |
| user_id | TEXT | — |
| organisation_id | TEXT | — |
| granted_by_id | TEXT | — |
| permission | portal.doc_permission | 'view' |
| expires_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## DocumentAccessLog  ->  `document_access_logs`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| sanity_document_id | TEXT | — |
| document_title | TEXT | — |
| action | portal.doc_access_action | — |
| ip | INET | — |
| user_agent | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## DocumentRequest  ->  `document_requests`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| subject | TEXT | — |
| detail | TEXT | — |
| sanity_opportunity_id | TEXT | — |
| type | portal.doc_request_type | 'data_room' |
| status | portal.doc_request_status | 'submitted' |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## NdaAgreement  ->  `nda_agreements`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| version | TEXT | — |
| ip | INET | — |
| user_agent | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## PortfolioPosition  ->  `portfolio_positions`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| name | TEXT | — |
| sanity_opportunity_id | TEXT | — |
| asset_class | TEXT | — |
| geography | TEXT | — |
| status | portal.position_status | 'committed' |
| acquisition_date | TIMESTAMPTZ | — |
| purchase_price | NUMERIC(18,2) | — |
| currency | TEXT | 'USD' |
| equity_deployed | NUMERIC(18,2) | — |
| debt_amount | NUMERIC(18,2) | — |
| debt_rate | NUMERIC(6,4) | — |
| debt_maturity | TIMESTAMPTZ | — |
| gross_income_annual | NUMERIC(18,2) | — |
| operating_expenses | NUMERIC(18,2) | — |
| noi_actual | NUMERIC(18,2) | — |
| occupancy_pct | NUMERIC(5,2) | — |
| valuation | NUMERIC(18,2) | — |
| valuation_date | TIMESTAMPTZ | — |
| valuation_basis | TEXT | — |
| notes | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## CapitalCall  ->  `capital_calls`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| position_id | TEXT | — |
| label | TEXT | — |
| amount | NUMERIC(18,2) | — |
| currency | TEXT | 'USD' |
| due_date | TIMESTAMPTZ | — |
| status | portal.capital_call_status | 'scheduled' |
| called_at | TIMESTAMPTZ | — |
| paid_at | TIMESTAMPTZ | — |
| notes | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## StaffProfile  ->  `staff_profiles`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| user_id | TEXT | — |
| admin_role | portal.admin_role | 'advisor' |
| title | TEXT | — |
| team | TEXT | — |
| is_active | BOOLEAN | TRUE |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## OrderStatusEvent  ->  `order_status_events`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| order_id | TEXT | — |
| from_status | portal.order_status | — |
| to_status | portal.order_status | — |
| changed_by_id | TEXT | — |
| note | TEXT | — |
| created_at | TIMESTAMPTZ | now() |

## RevenueEvent  ->  `revenue_events`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| order_id | TEXT | — |
| gross_kes | NUMERIC(18,2) | 0 |
| gross_usd | NUMERIC(18,2) | 0 |
| processing_usd | NUMERIC(18,2) | 0 |
| refund_usd | NUMERIC(18,2) | 0 |
| net_usd | NUMERIC(18,2) | 0 |
| recognised_at | TIMESTAMPTZ | now() |
| recognised_by_id | TEXT | — |
| note | TEXT | — |

## RefundAdjustment  ->  `refund_adjustments`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| order_id | TEXT | — |
| amount_usd | NUMERIC(18,2) | — |
| amount_kes | NUMERIC(18,2) | 0 |
| reason | TEXT | — |
| status | portal.refund_status | 'proposed' |
| requested_by_id | TEXT | — |
| reviewed_by_id | TEXT | — |
| reviewed_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | now() |

## ComplianceReview  ->  `compliance_reviews`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| subject_user_id | TEXT | — |
| reviewer_id | TEXT | — |
| decision | portal.review_decision | — |
| notes | TEXT | — |
| risk_flags | JSONB | — |
| detail | JSONB | — |
| created_at | TIMESTAMPTZ | now() |

## InternalNote  ->  `internal_notes`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| entity_type | TEXT | — |
| entity_id | TEXT | — |
| author_id | TEXT | — |
| body | TEXT | — |
| visibility | portal.note_visibility | 'staff' |
| created_at | TIMESTAMPTZ | now() |

## ContentMeta  ->  `content_meta`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| content_type | portal.content_type | — |
| sanity_id | TEXT | — |
| title | TEXT | — |
| tags | JSONB | — |
| status | portal.content_status | 'live' |
| featured | BOOLEAN | FALSE |
| visibility_tier | portal.access_tier | 'tier_1' |
| notes | TEXT | — |
| updated_by_id | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## SystemSetting  ->  `system_settings`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| key | TEXT | — |
| category | portal.setting_category | 'general' |
| value | JSONB | — |
| description | TEXT | — |
| updated_by_id | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

## AuditLog  ->  `logs`
| column | SQL type | default |
| --- | --- | --- |
| id | TEXT | — |
| actor_id | TEXT | — |
| actor_type | portal.actor_type | 'user' |
| action | TEXT | — |
| entity | TEXT | — |
| entity_id | TEXT | — |
| detail | JSONB | — |
| ip | INET | — |
| user_agent | TEXT | — |
| created_at | TIMESTAMPTZ | now() |
