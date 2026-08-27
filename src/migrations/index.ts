import * as migration_20260810_154228_initial from './20260810_154228_initial';
import * as migration_20260818_143035_brand_global from './20260818_143035_brand_global';
import * as migration_20260819_124926_add_user_roles from './20260819_124926_add_user_roles';
import * as migration_20260819_125503_remove_jobs_tables from './20260819_125503_remove_jobs_tables';
import * as migration_20260820_091507_add_programme_details_global from './20260820_091507_add_programme_details_global';
import * as migration_20260820_102319_update_enquiries_email_default from './20260820_102319_update_enquiries_email_default';
import * as migration_20260821_084454_add_workstream_detail_fields from './20260821_084454_add_workstream_detail_fields';
import * as migration_20260826_103739_add_workstream_resources from './20260826_103739_add_workstream_resources';
import * as migration_20260826_145839_team_groups_and_digit from './20260826_145839_team_groups_and_digit';
import * as migration_20260826_163823_team_group_values from './20260826_163823_team_group_values';
import * as migration_20260827_083749_team_workstream_leads_group from './20260827_083749_team_workstream_leads_group';
import * as migration_20260827_154700_widen_search_index from './20260827_154700_widen_search_index';

export const migrations = [
  {
    up: migration_20260810_154228_initial.up,
    down: migration_20260810_154228_initial.down,
    name: '20260810_154228_initial',
  },
  {
    up: migration_20260818_143035_brand_global.up,
    down: migration_20260818_143035_brand_global.down,
    name: '20260818_143035_brand_global',
  },
  {
    up: migration_20260819_124926_add_user_roles.up,
    down: migration_20260819_124926_add_user_roles.down,
    name: '20260819_124926_add_user_roles',
  },
  {
    up: migration_20260819_125503_remove_jobs_tables.up,
    down: migration_20260819_125503_remove_jobs_tables.down,
    name: '20260819_125503_remove_jobs_tables',
  },
  {
    up: migration_20260820_091507_add_programme_details_global.up,
    down: migration_20260820_091507_add_programme_details_global.down,
    name: '20260820_091507_add_programme_details_global',
  },
  {
    up: migration_20260820_102319_update_enquiries_email_default.up,
    down: migration_20260820_102319_update_enquiries_email_default.down,
    name: '20260820_102319_update_enquiries_email_default',
  },
  {
    up: migration_20260821_084454_add_workstream_detail_fields.up,
    down: migration_20260821_084454_add_workstream_detail_fields.down,
    name: '20260821_084454_add_workstream_detail_fields',
  },
  {
    up: migration_20260826_103739_add_workstream_resources.up,
    down: migration_20260826_103739_add_workstream_resources.down,
    name: '20260826_103739_add_workstream_resources',
  },
  {
    up: migration_20260826_145839_team_groups_and_digit.up,
    down: migration_20260826_145839_team_groups_and_digit.down,
    name: '20260826_145839_team_groups_and_digit',
  },
  {
    up: migration_20260826_163823_team_group_values.up,
    down: migration_20260826_163823_team_group_values.down,
    name: '20260826_163823_team_group_values',
  },
  {
    up: migration_20260827_083749_team_workstream_leads_group.up,
    down: migration_20260827_083749_team_workstream_leads_group.down,
    name: '20260827_083749_team_workstream_leads_group',
  },
  {
    up: migration_20260827_154700_widen_search_index.up,
    down: migration_20260827_154700_widen_search_index.down,
    name: '20260827_154700_widen_search_index'
  },
];
