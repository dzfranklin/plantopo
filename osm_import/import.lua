-- This file is separately licensed under <https://opensource.org/license/mit/>

local paths = osm2pgsql.define_table({ 
  name = 'paths',
  ids = { type = 'way', id_column = 'id', create_index = 'always' },
  columns = {
    { column = 'type', type = 'text' }, -- See get_highway_value
    { column = 'source', type = 'text' },
    { column = 'ref', type = 'text' },
    { column = 'name', type = 'text' },
    { column = 'description', type = 'text' }, -- <https://wiki.openstreetmap.org/wiki/Key:description>
    { column = 'note', type = 'text' }, -- <https://wiki.openstreetmap.org/wiki/Key:note>
    { column = 'legal_designation', type = 'text' }, -- <https://taginfo.openstreetmap.org.uk/keys/designation#overview>
    { column = 'eng_wales_prow', type = 'text' }, -- <https://wiki.openstreetmap.org/wiki/Key%3Aprow_ref>
    { column = 'symbol_osmc', type = 'text' }, -- For rendering see <https://hiking.waymarkedtrails.org/osmc_symbols.html>
    { column = 'tags', type = 'jsonb' },
  
    { column = 'route_id', type = 'bigint' },
    { column = 'paved', type = 'boolean' },
    { column = 'bicycle', type = 'boolean' },
    { column = 'horse', type = 'boolean' },
    { column = 'smoothness', type = 'text' }, -- <https://wiki.openstreetmap.org/wiki/Key:smoothness>
    { column = 'geom', type = 'linestring' },
  }
})

local routes = osm2pgsql.define_table({
  name = 'routes',
  ids = { type = 'relation', id_column = 'id', create_index = 'always' },
  columns = {
    { column = 'type', type = 'text' }, -- See get_route_type
    { column = 'source', type = 'text' },
    { column = 'ref', type = 'text' },
    { column = 'name', type = 'text' },
    { column = 'description', type = 'text' },
    { column = 'note', type = 'text' },
    { column = 'legal_designation', type = 'text' },
    { column = 'eng_wales_prow', type = 'text' },
    { column = 'symbol_osmc', type = 'text' },
    { column = 'tags', type = 'jsonb' },
  }
})

local get_route_type = osm2pgsql.make_check_values_func({ -- <https://wiki.openstreetmap.org/wiki/Key:route>
  'hiking', 'foot', 'mtb', 'running', 'horse', 'piste', 'ski',
})

local path_to_route = {}

-- Relation

-- TODO: This isn't working

function osm2pgsql.select_relation_members(obj)
  if obj.tags.type == 'route' then
    ids = osm2pgsql.way_member_ids(obj)

    for id in pairs(ids) do
      path_to_route[id] = obj.id
    end
 
    return { ways = ids }
  end
end

local clean_route_tags = osm2pgsql.make_clean_tags_func({
  'type', 'source', 'ref', 'route', 'name', 'description', 'note',
  'designation', 'prow_ref', 'symbol', 'osmc:symbol'
})

function osm2pgsql.process_relation(obj)
  local tags = obj.tags

  if tags.type ~= 'route' then return end

  local route_type = get_route_type(tags.route)
  if not route_type then return end

  name = tags.name
  source = tags.source
  ref = tags.ref
  description = tags.description
  note = tags.note
  legal_designation = tags.designation
  eng_wales_prow = tags.prow_ref
  symbol_osmc = tags['osmc:symbol']

  clean_route_tags(tags)

  routes:add_row({
    type = route_type,
    source = source,
    ref = ref,
    name = name,
    description = description,
    note = note,
    legal_designation = legal_designation,
    eng_wales_prow = eng_wales_prow,
    symbol_osmc = symbol_osmc,
    tags = tags,
  })
end

-- Way

local get_highway_value = osm2pgsql.make_check_values_func({
  -- A non-specific path. Use highway=footway for paths mainly for walkers,
  -- highway=cycleway for one also usable by cyclists, highway=bridleway for
  -- ones available to horse riders as well as walkers and highway=track for
  -- ones which is passable by agriculture or similar vehicles.
  'path',
  'track', -- Roads for mostly agricultural or forestry uses. To describe the quality of a track, see tracktype=*
  'footway', -- For designated footpaths; i.e., mainly/exclusively for pedestrians. This includes walking tracks and gravel paths.
  'steps', -- For flights of steps (stairs) on footways
  'bridleway', -- For horse riders.
  'cycleway', -- For designated cycleways.
})

local surface_is_paved = {
  ["asphalt"] = true,
  ["paved"] = true,
  ["concrete"] = true
}

function is_permit(tag)
  return tag == 'yes' or tag == 'designated' or tag == 'permissive' or tag == 'use_sidepath'
end

function is_prohibit(tag)
  return tag == 'no' or tag == 'private' or tag == 'customers'
end

local clean_path_tags = osm2pgsql.make_clean_tags_func({
  'highway', 'source', 'ref', 'state', 'area', 'name',
  'description', 'note', 'designation', 'prow_ref', 'symbol', 'osmc:symbol',
  'smoothness'
})

function osm2pgsql.process_way(obj)
  local tags = obj.tags

  local highway_type = get_highway_value(tags.highway)
  if not highway_type then return end

  if tags.state == 'proposed' then return end
  if tags.area == 'yes' then return end
  if is_prohibit(tags.foot) then return end
  if is_prohibit(tags.access) then return end
  if tags.footway == 'sidewalk' or tags.footway == 'crossing' then return end

  name = tags.name
  source = tags.source
  ref = tags.ref
  description = tags.description
  note = tags.note
  legal_designation = tags.designation
  eng_wales_prow = tags.prow_ref
  symbol_osmc = tags['osmc:symbol']
  route_id = path_to_route[obj.id]
  paved = surface_is_paved[tags.surface] or false
  bicycle = is_permit(tags.bicycle)
  horse = is_permit(tags.horse)
  smoothness = tags.smoothness

  clean_path_tags(tags)

  paths:add_row({
    type = highway_type,
    source = source,
    ref = ref,
    name = name,
    description = description,
    note = note,
    legal_designation = legal_designation,
    eng_wales_prow = eng_wales_prow,
    symbol_osmc = symbol_osmc,
    tags = tags,
    route_id = route_id,
    paved = paved,
    bicycle = bicycle,
    horse = horse,
    smoothness = smoothness,
    geom = { create = 'line' },
  })
end
