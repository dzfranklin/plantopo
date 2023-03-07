import * as ContextMenu from '@radix-ui/react-context-menu';
import { deleteFeature } from '../features/slice';
import { useAppDispatch } from '../hooks';

const FeatureContextMenu = ({ feature, setIsRename, setStyleOpen }) => {
  const dispatch = useAppDispatch();

  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        className="ContextMenuContent"
        loop={true}
        collisionPadding={5}
      >
        <ContextMenu.Item
          onClick={() => setTimeout(() => setIsRename(true))}
          className="ContextMenuItem"
        >
          Rename <div className="RightSlot">Alt+R</div>
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => dispatch(deleteFeature(feature))}
          className="ContextMenuItem"
        >
          Delete <div className="RightSlot">Del</div>
        </ContextMenu.Item>
        <ContextMenu.Item
          onClick={() => setStyleOpen(true)}
          className="ContextMenuItem"
        >
          Edit style <div className="RightSlot">Alt+S</div>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
};

export default FeatureContextMenu;
