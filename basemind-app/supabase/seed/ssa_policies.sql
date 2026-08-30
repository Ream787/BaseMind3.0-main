-- =====================================================================
-- SCOUTS South Africa constitution and policies
--
-- Every PDF listed on four pages of scouts.org.za as of 30 August 2026,
-- with the category it belongs in already filled in:
--
--   /ssa-constitution-policies/
--   /child-protection/
--   /ratified-social-partnership-agreements/
--   /members/adult-leaders/adult-leader-forms/
--
-- Run in the Supabase SQL Editor after migrations 0009 and 0011.
--
-- WHAT THIS DOES AND DOESN'T DO
--
-- It adds the title, the link and the category. It does NOT fetch the
-- documents: their text has to be extracted from the PDF, which SQL cannot
-- do, and the assistant answers only from extracted text.
--
-- So after running this, open Assistant -> Documents and press
-- "Download missing text". That fetches every one of these through the
-- server and reads it, which is the part that makes them answerable.
-- Until then they are listed but the assistant will not use them.
--
-- Safe to re-run: nothing is inserted if a document of that name already
-- exists, so it will not duplicate or overwrite anything you have edited.
--
-- Anything that isn't a PDF is left out — .docx, .doc and two .png
-- infographics — because the downloader reads PDFs and nothing else. They
-- are listed at the bottom so nothing goes missing quietly.
-- =====================================================================

begin;

insert into public.policies (title, category, source_url, content)
-- DISTINCT ON because the source pages overlap: the Child Protection
-- Policy is on two of them. Without it the statement would try to insert
-- the same title twice and trip the unique index.
select distinct on (lower(v.title)) v.title, v.category, v.url, ''
  from (values
      -- ---- Constitution and rules ----------------------------------
      ('SCOUTS South Africa Constitution', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/11/SSA-Amended-Constitution-2023v1-Final.pdf'),
      ('SSA Organisational Rules', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2025/05/Organisational-RulesF-November2022v2-ratified-15-Feb-2023.pdf'),
      ('Practice Note: Rover Programme Age Limits', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/Practice-note-Rover-Programme-Age-Limits-6-june-2019.pdf'),

      -- ---- Adult support -------------------------------------------
      ('Adult Support Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/10/Final-Adult-Support-Policy-August-2023v2.pdf'),
      ('Adult Support Practice Note 01: Appointment Process for all Roles', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/10/2.-Adult-Support-Practice-Note-01-Appointment-Process-for-all-Roles-in-SSA-Oct2023.pdf'),
      ('Adult Support Practice Note 02: Criminal Clearance', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/10/3.-Adult-Support-Practice-Note-02-Criminal-Clearance-16August2023.pdf'),
      ('Adult Support Practice Note 03: Recruitment, Warrant, Renewal and Exit', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2024/05/4.-Adult-Support-Practice-Note-03-Process-Flow-Documents-on-Recruitment-Warrant-Application-Renewal-and-Exit-23052024.pdf'),
      ('Adult Support Practice Note 04: Induction Guidelines for SGLs', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/10/5.-Adult-Support-Practice-Note-04-Induction-Guidelines-for-SGLs-16August2023.pdf'),
      ('Adult Support Practice Note 05: Letter of Appointment, Group Committee', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/10/6.-Adult-Support-Practice-Note-05-Pro-Forma-Letter-of-Appointment-Group-Committee-16August2023.pdf'),
      ('Adult Support Practice Note 06: Exit Interview Guidelines for SGLs', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/10/7.-Adult-Support-Practice-Note-06-Exit-Interview-Guidelines-for-SGLs-16August2023.pdf'),
      ('Adult Support Practice Note: Recognition of Current Competence', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2024/03/Adult-Support-Recognition-of-Current-Competence-Practice-Note-v4-2024.pdf'),

      -- ---- Young people --------------------------------------------
      ('Child Protection Policy', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/2024/07/Child-Protection-Policy-July-2024.pdf'),
      ('Child Protection Reporting Procedure', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/2014/02/Child-Protection-Info-Graphic-June-2015.pdf'),
      ('Young Leaders Involvement Policy', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Young-Leaders-Involvement-Policy-2021v1_June-2021.pdf'),
      ('Young Leaders Involvement Policy: Infographic', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/Young-Leaders-Involvement-Policy-infographic-June-2021F.pdf'),
      ('Young Leaders Involvement: National Youth Forum Procedures', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Young-Leaders-Involvement-Policy_Best-practise-Procedures-of-the-National-Youth-Forumv2021_1.pdf'),
      ('Social Media Policy', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Social-Media-Policy-2022v1.pdf'),
      ('Digital Asset Consent Form', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/digital-asset-consent-form-list-version1.pdf'),
      ('Digital Asset Objection Form', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/digital-asset-objection-form-generic-version-3.pdf'),

      -- ---- Safety ---------------------------------------------------
      ('Safe Scouting Policy', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Safe-Scouting-Policy-Feb-2022-v1.pdf'),
      ('Safe Scouting Practice Note: Air Activities', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Safe-Scouting-Practice-Note-Air-Activities_Oct2020.pdf'),
      ('Safe Scouting Practice Note: Hiking', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Safe-Scouting-Policy-Practice-Note_Hiking_Oct2020.pdf'),
      ('Safe Scouting Practice Note: Water Activities', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Safe-Scouting-Policy-Practice-Note-Water-Activities_March2022.pdf'),
      ('Safe Scouting Policy: Infographic', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/Infographic-Safe-Scouting-Policy-102020.pdf'),
      ('Pioneering Safety and Best Practices', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/Pioneering-safety-and-best-practices.pdf'),
      ('Regional Hiking Emergency Procedure', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/Regional-Hiking-Emergency-Procedure-2014-10-06.pdf'),

      -- ---- Camping and transport ------------------------------------
      ('Safe Scouting Practice Note: Camping', 'Camping',
       'https://www.scouts.org.za/wp-content/uploads/2025/10/SSA-Safe-Scouting-Policy_Practice-Note_Camping_October-2025.pdf'),
      ('Safe Scouting Practice Note: Transport', 'Transport',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Safe-Scouting-Policy-Practice-Note_Transport_March2022.pdf'),

      -- ---- Money ----------------------------------------------------
      ('Finance, Fundraising and Administration Policy', 'Money',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Finance-Fundraising-and-Administration-Policy-2019v1.pdf'),
      ('Retail Policy', 'Money',
       'https://www.scouts.org.za/wp-content/uploads/Retail-Policy-2016-v1-Oct-16-2.pdf'),

      -- ---- Conduct and discipline -----------------------------------
      ('Member Code of Conduct and Disciplinary Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Member-Code-of-Conduct-and-Disciplinary-Policy2019-v1.pdf'),
      ('Code of Conduct Practice Note 1: Adult Complaint and Grievance Procedure', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/M-CoC-Practice-Note-1-Adult-Member-Complaint-and-Grievance-Procedure-2019v1.pdf'),
      ('Code of Conduct Practice Note 2: Adult Disciplinary Code and Procedures', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/11/M-CoC-Practice-Note-2-Adult-Member-Disciplinary-Code-and-Procedures-2023v1.pdf'),
      ('Code of Conduct Practice Note 3: Youth and Rover Disciplinary Procedures', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/M-CoC-Practice-Note-3-Youth-Rover-Members-Disciplinary-Procedures-Oct-2019-v1.pdf'),
      ('Code of Conduct: Complaints and Grievance Flow Diagram', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/M-CoC-SSA-Complaints-Grievance-Flow-Diagram-October-2019-v1.0.pdf'),
      ('Code of Conduct: Disciplinary Flow Diagram', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/M-CoC-SSA-Disciplinary-Flow-Diagram-October-2019-v1.0.pdf'),

      -- ---- Running the group ----------------------------------------
      ('Ceremonies Regulations and Guidelines', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SCOUTS-South-Africa-Ceremonies-v2021.1.pdf'),
      ('Conflict of Interest Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Conflict-of-Interest-Policy2018v1.pdf'),
      ('International Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-International-Policy2021_v1.pdf'),
      ('Marketing and Branding Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SCOUTS-South-Africa-Marketing-and-Branding-Policy-v1_2016_Sep.pdf'),
      ('Property Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Property-policy_-2019v1_clean.pdf'),
      ('Property Protocols Covid-19: Lockdown Level 2', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Property-Protocols-Covid-19-Lockdown-Level-2-Final.pdf'),
      ('Property Protocols Covid-19: Lockdown Level 3', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Property-Protocols-Covid-19-Lockdown-Level-3.pdf'),
      ('POPIA: Protection of Personal Information and Retention Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/04/POPIA-SSA-Protection-of-Personal-Information-and-retention-Policy-18042023.pdf'),
      ('Privacy Notice', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Privacy-notice-Jul2022F.pdf'),
      ('Recognition and Awards Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Recogniton-and-Awards-Policy2020v1.pdf'),
      ('Uniform Policy', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2022/11/Uniform-policy-Oct-2022v2F.pdf'),

      -- ---- From the Child Protection page ---------------------------
      ('Safe from Harm: Anti-Bullying Toolkit (WOSM)', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/Safe-from-Harm-Anti-Bullying-toolkit_WOSM.pdf'),
      ('Fact Sheet: Teen Suicide Prevention', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/2014/02/Fact-Sheet-teen-suicide-prevention.pdf'),

      -- ---- Social partnership agreements ----------------------------
      ('Social Partnership Agreement: Community Group', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Social-Partnership-Agreement-Community-Group-2018v1.pdf'),
      ('Social Partnership Agreement: NGO Group', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Social-Partnership-Agreement-NGO-Group-2018v1.pdf'),
      ('Social Partnership Agreement: School Group', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/SSA-Social-Partnership-Agreement-School-Group-2018v1.pdf'),
      -- Listed on two of these pages under two URLs; this is the newer one.
      ('Registration of Group Form', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2025/05/Registration-of-Group-Form-2024-v2.pdf'),
      ('Registration of a New Unit in an Existing Group', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2024/04/Form-for-the-Registration-of-a-New-Unit-in-an-Existing-Group-June-2022.pdf'),

      -- ---- Adult leader forms: applications and nominations ---------
      ('Adult Event Consent Form', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2024/10/SSA-Adult-Consent-form-Oct-2024.pdf'),
      ('Adult Exit Interview Form', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2023/03/8b.-Adult-Exit-Interview-Form-v0.1-March-2023.pdf'),
      ('Affiliate Member Application', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2022/11/Affiliate-Member-of-SSA-June-2022-v0.6-Editable.pdf'),
      ('Application for Adult Membership', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2022/11/Application-for-Adult-Membership-Nov2022v6-Editable.pdf'),
      ('Confidential Reference Form', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Confidential-Reference-May-2020-v0.13-1.pdf'),
      ('Moments that Matter', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Moments-that-Matter-May-2020-v0.5.pdf'),
      ('Nomination Form: Region, District or Group Position', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2014/04/Nomination-Form-for-Region-District-or-Group-Position-v1.0.pdf'),
      ('Nomination Form: National Role', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Nomination-for-National-Role-Oct-2021-v1.pdf'),

      -- ---- Adult leader forms: warrants -----------------------------
      ('Role and Warrant Application', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2025/06/Role-and-Warrant-Application-June-2025.pdf'),
      ('Warrant Renewal, Suspension or Cancellation', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2024/05/Renewal-Suspension-Cancellation-of-Warrant-May-2024-v0.9-Editable.pdf'),

      -- ---- Adult leader forms: child protection ---------------------
      ('Parent Consent and Indemnity Form: Events', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/Parent-Consent-Indemnity-Form-Events-February-2022-v1.4.pdf'),
      ('Put Our Youth First: Yellow Card for Adults', 'Young people',
       'https://www.scouts.org.za/wp-content/uploads/2014/02/Adult-Leaders-Put-Our-Youth-First-yellow-card-for-adults.pdf'),

      -- ---- Adult leader forms: group management ---------------------
      ('Application for NPO and BEE Certificate', 'Money',
       'https://www.scouts.org.za/wp-content/uploads/2024/02/Application-for-a-letter-NPO-and-BEE-certificate-v2024.pdf'),
      ('Application for a Section 18A Certificate', 'Money',
       'https://www.scouts.org.za/wp-content/uploads/2024/02/Application-for-a-Section-18A-.pdf'),
      ('Guidelines for Opening a New Scout Group', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Guidelines-for-opening-a-new-Scout-Group-January-2020.pdf'),
      ('How to Open a Scout Group Bank Account', 'Money',
       'https://www.scouts.org.za/wp-content/uploads/2024/05/How-to-open-a-Scout-Group-Bank-Account.pdf'),
      ('Insurance Guidelines for Scout Groups', 'Money',
       'https://www.scouts.org.za/wp-content/uploads/2015/03/INSURANCE-FOR-SCOUT-GROUPS.pdf'),

      -- ---- Adult leader forms: permits and other --------------------
      ('Air Activities: Flying Consent Form', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/Air-Activities-Flying-consent-form.pdf'),
      ('Delegation of Authority Matrix', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/Delegation-of-Authority-Matrix2019v1signed.pdf'),
      ('Den Activity Permit Application', 'Activities',
       'https://www.scouts.org.za/wp-content/uploads/Den-Activity-_-Permit-Application-form-June-2020-v0.4.pdf'),
      ('Email Request Form', 'Running the group',
       'https://www.scouts.org.za/wp-content/uploads/2024/10/email-request-form-october-2024.pdf'),
      ('Incident Report Form', 'Safety',
       'https://www.scouts.org.za/wp-content/uploads/Incident-Report-Form-v1.pdf'),
      ('Pack Activity Permit Application', 'Activities',
       'https://www.scouts.org.za/wp-content/uploads/Pack-Activity-_-Permit-Application-form-March-2018-v3.0.pdf'),
      ('Permit Application: Drakensberg', 'Activities',
       'https://www.scouts.org.za/wp-content/uploads/Permit-Application-Drakensberg-Jul-2019-v1.0.pdf'),
      ('Scout or Patrol Activity Permit Application', 'Activities',
       'https://www.scouts.org.za/wp-content/uploads/Scout-or-Patrol-Activity_-Permit-application-form-March-2018-v3.0.pdf'),
      ('Troop Activity Permit Application', 'Activities',
       'https://www.scouts.org.za/wp-content/uploads/Troop-Activity-_-Permit-application-form-March-2018-v3.0.pdf')
  ) as v(title, category, url)
 -- Nothing is replaced. If you have already added a document of that name,
 -- yours stays exactly as it is, text and all.
 where not exists (
   select 1 from public.policies p where lower(p.title) = lower(v.title)
 )
 order by lower(v.title);

commit;

-- ---------------------------------------------------------------------
-- What you should see: 80 documents, all with a link and no text yet.
--
-- The "text read" column stays 0 until you press "Download missing text"
-- on the Documents tab. That is the step that makes them answerable.
-- ---------------------------------------------------------------------
select count(*) filter (where source_url is not null)            as with_a_link,
       count(*) filter (where btrim(content) = '')               as no_text_yet,
       count(*) filter (where btrim(content) <> '')              as text_read
  from public.policies;

-- ---------------------------------------------------------------------
-- Deliberately not included: the files on those pages that are not PDFs.
--
-- The downloader reads PDFs and nothing else, and most of these are blank
-- templates rather than policy text, so there would be nothing to answer
-- from even if it could open them. Add them by hand if you want them stored:
--
--   .docx  M CoC F1 Statement Form
--   .docx  M CoC F2 Investigation Form
--   .docx  M CoC G1 Step 1 and G2 Step 2 Grievance Forms
--   .docx  M CoC A1 Notice of Appeal
--   .docx  M CoC A2 Record of Appeal Hearing
--   .docx  M CoC D1 Notice to Attend a Disciplinary Hearing
--   .docx  M CoC D2 Record of Disciplinary and Sanction Hearings
--   .docx  M CoC D3 Notice of Outcome of Disciplinary and Sanction Hearings
--   .docx  M CoC WST 1 Notice of Warning
--   .docx  M CoC WST 2 Notice of Suspension
--   .docx  M CoC WST 3 Notice of Termination of Membership
--   .docx  Application for a letter NPO and BEE certificate (a PDF of the
--          2024 version IS included above)
--   .docx  Nomination for Chief Scout 2026
--   .docx  Scouting CV template
--   .docx  Water Saver Challenge Badge, Rovers and Adults
--   .doc   WBadge application
--   .png   Safe from Harm Framework infographic
--   .png   Criminal Clearance: count to 5
-- ---------------------------------------------------------------------
