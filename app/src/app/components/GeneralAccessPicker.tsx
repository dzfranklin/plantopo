import { GeneralAccessLevel, GeneralAccessRole } from '@/api/map/MapAccess';
import { Item, Picker, Text } from '@adobe/react-spectrum';
import PublicIcon from '@spectrum-icons/workflow/GlobeOutline';
import RestrictedIcon from '@spectrum-icons/workflow/UsersLock';

export function GeneralAccessPicker({
  level,
  role,
  setLevel,
  setRole,
  isDisabled,
}: {
  level: GeneralAccessLevel;
  role: GeneralAccessRole;
  setLevel: (_: GeneralAccessLevel) => any;
  setRole: (_: GeneralAccessRole) => any;
  isDisabled?: boolean;
}) {
  return (
    <div className="grid items-center grid-cols-[min-content_minmax(0,1fr)_min-content] grid-rows-[minmax(0,1fr)_min-content]">
      <div className="mr-6 row-span-full">
        <span className="flex items-center col-start-1 p-2 text-gray-700 bg-gray-200 rounded-full row-span-full">
          {level === 'public' && <PublicIcon />}
          {level === 'restricted' && <RestrictedIcon />}
        </span>
      </div>

      <Picker
        selectedKey={level}
        onSelectionChange={(key) => {
          if (key !== 'public' && key !== 'restricted') {
            throw new Error('Unreachable');
          }
          setLevel(key);
        }}
        isDisabled={isDisabled}
        aria-label="access level"
        width="7em"
        isQuiet
      >
        <Item key="restricted" textValue="Restricted">
          <Text UNSAFE_className="font-semibold">Restricted</Text>
        </Item>
        <Item key="public" textValue="Public">
          <Text UNSAFE_className="font-semibold">Public</Text>
        </Item>
      </Picker>

      {level !== 'restricted' && (
        <Picker
          gridRow="1 / -1"
          selectedKey={role}
          onSelectionChange={(key) => {
            if (key !== 'viewer' && key !== 'editor') {
              throw new Error('Unreachable');
            }
            setRole(key);
          }}
          isDisabled={isDisabled}
          aria-label="public access role"
          width="min-content"
          isQuiet
        >
          <Item key="viewer">Viewer</Item>
          <Item key="editor">Editor</Item>
        </Picker>
      )}

      <span className="col-start-2 row-start-2 text-sm col-span-full">
        {descriptionOf(level, role)}
      </span>
    </div>
  );
}

const descriptionOf = (
  level: GeneralAccessLevel,
  role: GeneralAccessRole,
): string => {
  if (level === 'restricted') {
    return 'Only people with access can open the map';
  } else if (level === 'public') {
    let ability;
    switch (role) {
      case 'viewer':
        ability = 'view';
        break;
      case 'editor':
        ability = 'edit';
        break;
      default:
        throw new Error('Unreachable');
    }
    return `Everyone on the internet can ${ability} the map`;
  } else {
    throw new Error('Unreachable');
  }
};
