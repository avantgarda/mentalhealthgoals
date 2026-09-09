import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Version history for the collections and globals that had none.
 *
 * Workstreams, People, Partners and Categories, and the Header, Footer, Brand
 * and Programme Details globals, all went live on save with no way back: an
 * edit to a workstream's eight prose fields left nothing to restore. Each now
 * keeps ten revisions — `versions` without `drafts`, so no `_status` field and
 * no publish gate, and every public query is unchanged.
 *
 * Purely additive: nineteen `_*_v` tables, their sequences, indexes and
 * constraints, and six enums mirroring the parents' select fields. Existing
 * tables are untouched. Pages and Posts already had version tables; only their
 * `maxPerDoc` changed, which is runtime pruning rather than schema.
 *
 * Written by hand from a push-built schema rather than `migrate:create`: the
 * drizzle snapshot chain stops at 20260901_233244, so the generator would diff
 * against a week-old baseline. `pnpm check:migrations` is the proof of parity.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE public.enum__brand_v_version_logo_variant AS ENUM (
       'summit',
       'sunInCol',
       'rings',
       'writtenInWater',
       'goalInWater'
   );

   CREATE TYPE public.enum__footer_v_version_nav_items_link_type AS ENUM (
       'reference',
       'custom'
   );

   CREATE TYPE public.enum__header_v_version_nav_items_link_type AS ENUM (
       'reference',
       'custom'
   );

   CREATE TYPE public.enum__partners_v_version_role AS ENUM (
       'funder',
       'delivery',
       'partner'
   );

   CREATE TYPE public.enum__people_v_version_group AS ENUM (
       'leadership',
       'workstream-leads',
       'delivery'
   );

   CREATE TYPE public.enum__workstreams_v_version_group AS ENUM (
       'digit'
   );

   CREATE TABLE public._brand_v (
       id integer NOT NULL,
       version_logo_variant public.enum__brand_v_version_logo_variant DEFAULT 'summit'::public.enum__brand_v_version_logo_variant NOT NULL,
       version_show_tagline boolean DEFAULT true,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._brand_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._brand_v_id_seq OWNED BY public._brand_v.id;

   CREATE TABLE public._categories_v (
       id integer NOT NULL,
       parent_id integer,
       version_title character varying NOT NULL,
       version_generate_slug boolean DEFAULT true,
       version_slug character varying NOT NULL,
       version_parent_id integer,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._categories_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._categories_v_id_seq OWNED BY public._categories_v.id;

   CREATE TABLE public._categories_v_version_breadcrumbs (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       doc_id integer,
       url character varying,
       label character varying,
       _uuid character varying
   );

   CREATE SEQUENCE public._categories_v_version_breadcrumbs_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._categories_v_version_breadcrumbs_id_seq OWNED BY public._categories_v_version_breadcrumbs.id;

   CREATE TABLE public._footer_v (
       id integer NOT NULL,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._footer_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._footer_v_id_seq OWNED BY public._footer_v.id;

   CREATE TABLE public._footer_v_rels (
       id integer NOT NULL,
       "order" integer,
       parent_id integer NOT NULL,
       path character varying NOT NULL,
       pages_id integer,
       posts_id integer
   );

   CREATE SEQUENCE public._footer_v_rels_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._footer_v_rels_id_seq OWNED BY public._footer_v_rels.id;

   CREATE TABLE public._footer_v_version_nav_items (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       link_type public.enum__footer_v_version_nav_items_link_type DEFAULT 'reference'::public.enum__footer_v_version_nav_items_link_type,
       link_new_tab boolean,
       link_url character varying,
       link_label character varying NOT NULL,
       small_print boolean DEFAULT false,
       _uuid character varying
   );

   CREATE SEQUENCE public._footer_v_version_nav_items_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._footer_v_version_nav_items_id_seq OWNED BY public._footer_v_version_nav_items.id;

   CREATE TABLE public._header_v (
       id integer NOT NULL,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._header_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._header_v_id_seq OWNED BY public._header_v.id;

   CREATE TABLE public._header_v_rels (
       id integer NOT NULL,
       "order" integer,
       parent_id integer NOT NULL,
       path character varying NOT NULL,
       pages_id integer,
       posts_id integer
   );

   CREATE SEQUENCE public._header_v_rels_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._header_v_rels_id_seq OWNED BY public._header_v_rels.id;

   CREATE TABLE public._header_v_version_nav_items (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       link_type public.enum__header_v_version_nav_items_link_type DEFAULT 'reference'::public.enum__header_v_version_nav_items_link_type,
       link_new_tab boolean,
       link_url character varying,
       link_label character varying NOT NULL,
       _uuid character varying
   );

   CREATE SEQUENCE public._header_v_version_nav_items_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._header_v_version_nav_items_id_seq OWNED BY public._header_v_version_nav_items.id;

   CREATE TABLE public._partners_v (
       id integer NOT NULL,
       parent_id integer,
       version_name character varying NOT NULL,
       version_strapline character varying,
       version_url character varying,
       version_role public.enum__partners_v_version_role DEFAULT 'partner'::public.enum__partners_v_version_role NOT NULL,
       version_logo_id integer,
       version_show_name_with_logo boolean DEFAULT false,
       version_logo_scale numeric DEFAULT 1,
       version_show_in_footer boolean DEFAULT false,
       version_order numeric DEFAULT 0,
       version_usage_note character varying,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._partners_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._partners_v_id_seq OWNED BY public._partners_v.id;

   CREATE TABLE public._people_v (
       id integer NOT NULL,
       parent_id integer,
       version_name character varying NOT NULL,
       version_role character varying NOT NULL,
       version_organisation character varying NOT NULL,
       version_bio character varying,
       version_profile_url character varying,
       version_group public.enum__people_v_version_group DEFAULT 'delivery'::public.enum__people_v_version_group NOT NULL,
       version_photo_id integer,
       version_order numeric DEFAULT 99,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._people_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._people_v_id_seq OWNED BY public._people_v.id;

   CREATE TABLE public._people_v_rels (
       id integer NOT NULL,
       "order" integer,
       parent_id integer NOT NULL,
       path character varying NOT NULL,
       workstreams_id integer
   );

   CREATE SEQUENCE public._people_v_rels_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._people_v_rels_id_seq OWNED BY public._people_v_rels.id;

   CREATE TABLE public._programme_details_v (
       id integer NOT NULL,
       version_name character varying DEFAULT 'Mental Health Goals Programme'::character varying NOT NULL,
       version_description character varying DEFAULT 'A UK Government-backed, UK-wide programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.'::character varying,
       version_email character varying DEFAULT 'enquiries@mentalhealthgoals.co.uk'::character varying,
       version_phone character varying,
       version_address character varying,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._programme_details_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._programme_details_v_id_seq OWNED BY public._programme_details_v.id;

   CREATE TABLE public._workstreams_v (
       id integer NOT NULL,
       parent_id integer,
       version_number numeric NOT NULL,
       version_title character varying NOT NULL,
       version_summary character varying NOT NULL,
       version_description character varying,
       version_delivered_by character varying NOT NULL,
       version_group public.enum__workstreams_v_version_group,
       version_boundary_statement character varying,
       version_generate_slug boolean DEFAULT true,
       version_slug character varying NOT NULL,
       version_updated_at timestamp(3) with time zone,
       version_created_at timestamp(3) with time zone,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE SEQUENCE public._workstreams_v_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._workstreams_v_id_seq OWNED BY public._workstreams_v.id;

   CREATE TABLE public._workstreams_v_rels (
       id integer NOT NULL,
       "order" integer,
       parent_id integer NOT NULL,
       path character varying NOT NULL,
       partners_id integer
   );

   CREATE SEQUENCE public._workstreams_v_rels_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._workstreams_v_rels_id_seq OWNED BY public._workstreams_v_rels.id;

   CREATE TABLE public._workstreams_v_version_differentiators (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       point character varying NOT NULL,
       _uuid character varying
   );

   CREATE SEQUENCE public._workstreams_v_version_differentiators_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._workstreams_v_version_differentiators_id_seq OWNED BY public._workstreams_v_version_differentiators.id;

   CREATE TABLE public._workstreams_v_version_key_questions (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       point character varying NOT NULL,
       _uuid character varying
   );

   CREATE SEQUENCE public._workstreams_v_version_key_questions_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._workstreams_v_version_key_questions_id_seq OWNED BY public._workstreams_v_version_key_questions.id;

   CREATE TABLE public._workstreams_v_version_primary_focus (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       point character varying NOT NULL,
       _uuid character varying
   );

   CREATE SEQUENCE public._workstreams_v_version_primary_focus_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._workstreams_v_version_primary_focus_id_seq OWNED BY public._workstreams_v_version_primary_focus.id;

   CREATE TABLE public._workstreams_v_version_resources (
       _order integer NOT NULL,
       _parent_id integer NOT NULL,
       id integer NOT NULL,
       label character varying NOT NULL,
       url character varying NOT NULL,
       _uuid character varying
   );

   CREATE SEQUENCE public._workstreams_v_version_resources_id_seq
       AS integer
       START WITH 1
       INCREMENT BY 1
       NO MINVALUE
       NO MAXVALUE
       CACHE 1;

   ALTER SEQUENCE public._workstreams_v_version_resources_id_seq OWNED BY public._workstreams_v_version_resources.id;

   ALTER TABLE ONLY public._brand_v ALTER COLUMN id SET DEFAULT nextval('public._brand_v_id_seq'::regclass);

   ALTER TABLE ONLY public._categories_v ALTER COLUMN id SET DEFAULT nextval('public._categories_v_id_seq'::regclass);

   ALTER TABLE ONLY public._categories_v_version_breadcrumbs ALTER COLUMN id SET DEFAULT nextval('public._categories_v_version_breadcrumbs_id_seq'::regclass);

   ALTER TABLE ONLY public._footer_v ALTER COLUMN id SET DEFAULT nextval('public._footer_v_id_seq'::regclass);

   ALTER TABLE ONLY public._footer_v_rels ALTER COLUMN id SET DEFAULT nextval('public._footer_v_rels_id_seq'::regclass);

   ALTER TABLE ONLY public._footer_v_version_nav_items ALTER COLUMN id SET DEFAULT nextval('public._footer_v_version_nav_items_id_seq'::regclass);

   ALTER TABLE ONLY public._header_v ALTER COLUMN id SET DEFAULT nextval('public._header_v_id_seq'::regclass);

   ALTER TABLE ONLY public._header_v_rels ALTER COLUMN id SET DEFAULT nextval('public._header_v_rels_id_seq'::regclass);

   ALTER TABLE ONLY public._header_v_version_nav_items ALTER COLUMN id SET DEFAULT nextval('public._header_v_version_nav_items_id_seq'::regclass);

   ALTER TABLE ONLY public._partners_v ALTER COLUMN id SET DEFAULT nextval('public._partners_v_id_seq'::regclass);

   ALTER TABLE ONLY public._people_v ALTER COLUMN id SET DEFAULT nextval('public._people_v_id_seq'::regclass);

   ALTER TABLE ONLY public._people_v_rels ALTER COLUMN id SET DEFAULT nextval('public._people_v_rels_id_seq'::regclass);

   ALTER TABLE ONLY public._programme_details_v ALTER COLUMN id SET DEFAULT nextval('public._programme_details_v_id_seq'::regclass);

   ALTER TABLE ONLY public._workstreams_v ALTER COLUMN id SET DEFAULT nextval('public._workstreams_v_id_seq'::regclass);

   ALTER TABLE ONLY public._workstreams_v_rels ALTER COLUMN id SET DEFAULT nextval('public._workstreams_v_rels_id_seq'::regclass);

   ALTER TABLE ONLY public._workstreams_v_version_differentiators ALTER COLUMN id SET DEFAULT nextval('public._workstreams_v_version_differentiators_id_seq'::regclass);

   ALTER TABLE ONLY public._workstreams_v_version_key_questions ALTER COLUMN id SET DEFAULT nextval('public._workstreams_v_version_key_questions_id_seq'::regclass);

   ALTER TABLE ONLY public._workstreams_v_version_primary_focus ALTER COLUMN id SET DEFAULT nextval('public._workstreams_v_version_primary_focus_id_seq'::regclass);

   ALTER TABLE ONLY public._workstreams_v_version_resources ALTER COLUMN id SET DEFAULT nextval('public._workstreams_v_version_resources_id_seq'::regclass);

   ALTER TABLE ONLY public._brand_v
       ADD CONSTRAINT _brand_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._categories_v
       ADD CONSTRAINT _categories_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._categories_v_version_breadcrumbs
       ADD CONSTRAINT _categories_v_version_breadcrumbs_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._footer_v
       ADD CONSTRAINT _footer_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._footer_v_rels
       ADD CONSTRAINT _footer_v_rels_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._footer_v_version_nav_items
       ADD CONSTRAINT _footer_v_version_nav_items_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._header_v
       ADD CONSTRAINT _header_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._header_v_rels
       ADD CONSTRAINT _header_v_rels_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._header_v_version_nav_items
       ADD CONSTRAINT _header_v_version_nav_items_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._partners_v
       ADD CONSTRAINT _partners_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._people_v
       ADD CONSTRAINT _people_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._people_v_rels
       ADD CONSTRAINT _people_v_rels_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._programme_details_v
       ADD CONSTRAINT _programme_details_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._workstreams_v
       ADD CONSTRAINT _workstreams_v_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._workstreams_v_rels
       ADD CONSTRAINT _workstreams_v_rels_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._workstreams_v_version_differentiators
       ADD CONSTRAINT _workstreams_v_version_differentiators_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._workstreams_v_version_key_questions
       ADD CONSTRAINT _workstreams_v_version_key_questions_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._workstreams_v_version_primary_focus
       ADD CONSTRAINT _workstreams_v_version_primary_focus_pkey PRIMARY KEY (id);

   ALTER TABLE ONLY public._workstreams_v_version_resources
       ADD CONSTRAINT _workstreams_v_version_resources_pkey PRIMARY KEY (id);

   CREATE INDEX _brand_v_created_at_idx ON public._brand_v USING btree (created_at);

   CREATE INDEX _brand_v_updated_at_idx ON public._brand_v USING btree (updated_at);

   CREATE INDEX _categories_v_created_at_idx ON public._categories_v USING btree (created_at);

   CREATE INDEX _categories_v_parent_idx ON public._categories_v USING btree (parent_id);

   CREATE INDEX _categories_v_updated_at_idx ON public._categories_v USING btree (updated_at);

   CREATE INDEX _categories_v_version_breadcrumbs_doc_idx ON public._categories_v_version_breadcrumbs USING btree (doc_id);

   CREATE INDEX _categories_v_version_breadcrumbs_order_idx ON public._categories_v_version_breadcrumbs USING btree (_order);

   CREATE INDEX _categories_v_version_breadcrumbs_parent_id_idx ON public._categories_v_version_breadcrumbs USING btree (_parent_id);

   CREATE INDEX _categories_v_version_version_created_at_idx ON public._categories_v USING btree (version_created_at);

   CREATE INDEX _categories_v_version_version_parent_idx ON public._categories_v USING btree (version_parent_id);

   CREATE INDEX _categories_v_version_version_slug_idx ON public._categories_v USING btree (version_slug);

   CREATE INDEX _categories_v_version_version_updated_at_idx ON public._categories_v USING btree (version_updated_at);

   CREATE INDEX _footer_v_created_at_idx ON public._footer_v USING btree (created_at);

   CREATE INDEX _footer_v_rels_order_idx ON public._footer_v_rels USING btree ("order");

   CREATE INDEX _footer_v_rels_pages_id_idx ON public._footer_v_rels USING btree (pages_id);

   CREATE INDEX _footer_v_rels_parent_idx ON public._footer_v_rels USING btree (parent_id);

   CREATE INDEX _footer_v_rels_path_idx ON public._footer_v_rels USING btree (path);

   CREATE INDEX _footer_v_rels_posts_id_idx ON public._footer_v_rels USING btree (posts_id);

   CREATE INDEX _footer_v_updated_at_idx ON public._footer_v USING btree (updated_at);

   CREATE INDEX _footer_v_version_nav_items_order_idx ON public._footer_v_version_nav_items USING btree (_order);

   CREATE INDEX _footer_v_version_nav_items_parent_id_idx ON public._footer_v_version_nav_items USING btree (_parent_id);

   CREATE INDEX _header_v_created_at_idx ON public._header_v USING btree (created_at);

   CREATE INDEX _header_v_rels_order_idx ON public._header_v_rels USING btree ("order");

   CREATE INDEX _header_v_rels_pages_id_idx ON public._header_v_rels USING btree (pages_id);

   CREATE INDEX _header_v_rels_parent_idx ON public._header_v_rels USING btree (parent_id);

   CREATE INDEX _header_v_rels_path_idx ON public._header_v_rels USING btree (path);

   CREATE INDEX _header_v_rels_posts_id_idx ON public._header_v_rels USING btree (posts_id);

   CREATE INDEX _header_v_updated_at_idx ON public._header_v USING btree (updated_at);

   CREATE INDEX _header_v_version_nav_items_order_idx ON public._header_v_version_nav_items USING btree (_order);

   CREATE INDEX _header_v_version_nav_items_parent_id_idx ON public._header_v_version_nav_items USING btree (_parent_id);

   CREATE INDEX _partners_v_created_at_idx ON public._partners_v USING btree (created_at);

   CREATE INDEX _partners_v_parent_idx ON public._partners_v USING btree (parent_id);

   CREATE INDEX _partners_v_updated_at_idx ON public._partners_v USING btree (updated_at);

   CREATE INDEX _partners_v_version_version_created_at_idx ON public._partners_v USING btree (version_created_at);

   CREATE INDEX _partners_v_version_version_logo_idx ON public._partners_v USING btree (version_logo_id);

   CREATE INDEX _partners_v_version_version_updated_at_idx ON public._partners_v USING btree (version_updated_at);

   CREATE INDEX _people_v_created_at_idx ON public._people_v USING btree (created_at);

   CREATE INDEX _people_v_parent_idx ON public._people_v USING btree (parent_id);

   CREATE INDEX _people_v_rels_order_idx ON public._people_v_rels USING btree ("order");

   CREATE INDEX _people_v_rels_parent_idx ON public._people_v_rels USING btree (parent_id);

   CREATE INDEX _people_v_rels_path_idx ON public._people_v_rels USING btree (path);

   CREATE INDEX _people_v_rels_workstreams_id_idx ON public._people_v_rels USING btree (workstreams_id);

   CREATE INDEX _people_v_updated_at_idx ON public._people_v USING btree (updated_at);

   CREATE INDEX _people_v_version_version_created_at_idx ON public._people_v USING btree (version_created_at);

   CREATE INDEX _people_v_version_version_photo_idx ON public._people_v USING btree (version_photo_id);

   CREATE INDEX _people_v_version_version_updated_at_idx ON public._people_v USING btree (version_updated_at);

   CREATE INDEX _programme_details_v_created_at_idx ON public._programme_details_v USING btree (created_at);

   CREATE INDEX _programme_details_v_updated_at_idx ON public._programme_details_v USING btree (updated_at);

   CREATE INDEX _workstreams_v_created_at_idx ON public._workstreams_v USING btree (created_at);

   CREATE INDEX _workstreams_v_parent_idx ON public._workstreams_v USING btree (parent_id);

   CREATE INDEX _workstreams_v_rels_order_idx ON public._workstreams_v_rels USING btree ("order");

   CREATE INDEX _workstreams_v_rels_parent_idx ON public._workstreams_v_rels USING btree (parent_id);

   CREATE INDEX _workstreams_v_rels_partners_id_idx ON public._workstreams_v_rels USING btree (partners_id);

   CREATE INDEX _workstreams_v_rels_path_idx ON public._workstreams_v_rels USING btree (path);

   CREATE INDEX _workstreams_v_updated_at_idx ON public._workstreams_v USING btree (updated_at);

   CREATE INDEX _workstreams_v_version_differentiators_order_idx ON public._workstreams_v_version_differentiators USING btree (_order);

   CREATE INDEX _workstreams_v_version_differentiators_parent_id_idx ON public._workstreams_v_version_differentiators USING btree (_parent_id);

   CREATE INDEX _workstreams_v_version_key_questions_order_idx ON public._workstreams_v_version_key_questions USING btree (_order);

   CREATE INDEX _workstreams_v_version_key_questions_parent_id_idx ON public._workstreams_v_version_key_questions USING btree (_parent_id);

   CREATE INDEX _workstreams_v_version_primary_focus_order_idx ON public._workstreams_v_version_primary_focus USING btree (_order);

   CREATE INDEX _workstreams_v_version_primary_focus_parent_id_idx ON public._workstreams_v_version_primary_focus USING btree (_parent_id);

   CREATE INDEX _workstreams_v_version_resources_order_idx ON public._workstreams_v_version_resources USING btree (_order);

   CREATE INDEX _workstreams_v_version_resources_parent_id_idx ON public._workstreams_v_version_resources USING btree (_parent_id);

   CREATE INDEX _workstreams_v_version_version_created_at_idx ON public._workstreams_v USING btree (version_created_at);

   CREATE INDEX _workstreams_v_version_version_slug_idx ON public._workstreams_v USING btree (version_slug);

   CREATE INDEX _workstreams_v_version_version_updated_at_idx ON public._workstreams_v USING btree (version_updated_at);

   ALTER TABLE ONLY public._categories_v
       ADD CONSTRAINT _categories_v_parent_id_categories_id_fk FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._categories_v_version_breadcrumbs
       ADD CONSTRAINT _categories_v_version_breadcrumbs_doc_id_categories_id_fk FOREIGN KEY (doc_id) REFERENCES public.categories(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._categories_v_version_breadcrumbs
       ADD CONSTRAINT _categories_v_version_breadcrumbs_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._categories_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._categories_v
       ADD CONSTRAINT _categories_v_version_parent_id_categories_id_fk FOREIGN KEY (version_parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._footer_v_rels
       ADD CONSTRAINT _footer_v_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._footer_v_rels
       ADD CONSTRAINT _footer_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._footer_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._footer_v_rels
       ADD CONSTRAINT _footer_v_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._footer_v_version_nav_items
       ADD CONSTRAINT _footer_v_version_nav_items_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._footer_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._header_v_rels
       ADD CONSTRAINT _header_v_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._header_v_rels
       ADD CONSTRAINT _header_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._header_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._header_v_rels
       ADD CONSTRAINT _header_v_rels_posts_fk FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._header_v_version_nav_items
       ADD CONSTRAINT _header_v_version_nav_items_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._header_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._partners_v
       ADD CONSTRAINT _partners_v_parent_id_partners_id_fk FOREIGN KEY (parent_id) REFERENCES public.partners(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._partners_v
       ADD CONSTRAINT _partners_v_version_logo_id_media_id_fk FOREIGN KEY (version_logo_id) REFERENCES public.media(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._people_v
       ADD CONSTRAINT _people_v_parent_id_people_id_fk FOREIGN KEY (parent_id) REFERENCES public.people(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._people_v_rels
       ADD CONSTRAINT _people_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._people_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._people_v_rels
       ADD CONSTRAINT _people_v_rels_workstreams_fk FOREIGN KEY (workstreams_id) REFERENCES public.workstreams(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._people_v
       ADD CONSTRAINT _people_v_version_photo_id_media_id_fk FOREIGN KEY (version_photo_id) REFERENCES public.media(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._workstreams_v
       ADD CONSTRAINT _workstreams_v_parent_id_workstreams_id_fk FOREIGN KEY (parent_id) REFERENCES public.workstreams(id) ON DELETE SET NULL;

   ALTER TABLE ONLY public._workstreams_v_rels
       ADD CONSTRAINT _workstreams_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._workstreams_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._workstreams_v_rels
       ADD CONSTRAINT _workstreams_v_rels_partners_fk FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._workstreams_v_version_differentiators
       ADD CONSTRAINT _workstreams_v_version_differentiators_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._workstreams_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._workstreams_v_version_key_questions
       ADD CONSTRAINT _workstreams_v_version_key_questions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._workstreams_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._workstreams_v_version_primary_focus
       ADD CONSTRAINT _workstreams_v_version_primary_focus_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._workstreams_v(id) ON DELETE CASCADE;

   ALTER TABLE ONLY public._workstreams_v_version_resources
       ADD CONSTRAINT _workstreams_v_version_resources_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._workstreams_v(id) ON DELETE CASCADE;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS public._workstreams_v_version_resources CASCADE;
   DROP TABLE IF EXISTS public._workstreams_v_version_primary_focus CASCADE;
   DROP TABLE IF EXISTS public._workstreams_v_version_key_questions CASCADE;
   DROP TABLE IF EXISTS public._workstreams_v_version_differentiators CASCADE;
   DROP TABLE IF EXISTS public._workstreams_v_rels CASCADE;
   DROP TABLE IF EXISTS public._workstreams_v CASCADE;
   DROP TABLE IF EXISTS public._programme_details_v CASCADE;
   DROP TABLE IF EXISTS public._people_v_rels CASCADE;
   DROP TABLE IF EXISTS public._people_v CASCADE;
   DROP TABLE IF EXISTS public._partners_v CASCADE;
   DROP TABLE IF EXISTS public._header_v_version_nav_items CASCADE;
   DROP TABLE IF EXISTS public._header_v_rels CASCADE;
   DROP TABLE IF EXISTS public._header_v CASCADE;
   DROP TABLE IF EXISTS public._footer_v_version_nav_items CASCADE;
   DROP TABLE IF EXISTS public._footer_v_rels CASCADE;
   DROP TABLE IF EXISTS public._footer_v CASCADE;
   DROP TABLE IF EXISTS public._categories_v_version_breadcrumbs CASCADE;
   DROP TABLE IF EXISTS public._categories_v CASCADE;
   DROP TABLE IF EXISTS public._brand_v CASCADE;
   DROP TYPE IF EXISTS public.enum__brand_v_version_logo_variant;
   DROP TYPE IF EXISTS public.enum__footer_v_version_nav_items_link_type;
   DROP TYPE IF EXISTS public.enum__header_v_version_nav_items_link_type;
   DROP TYPE IF EXISTS public.enum__partners_v_version_role;
   DROP TYPE IF EXISTS public.enum__people_v_version_group;
   DROP TYPE IF EXISTS public.enum__workstreams_v_version_group;`)
}
