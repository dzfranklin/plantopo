import { MapMeta } from '../api/mapMeta';
import {
  Cell,
  Column,
  Row,
  TableView,
  TableBody,
  TableHeader,
  ActionBarContainer,
  Selection,
  ActionBar,
  Item,
  ActionButton,
  DialogTrigger,
  ProgressCircle,
} from '@adobe/react-spectrum';
import { ReactElement, useState } from 'react';
import { DateTimeText } from '@/generic/DateTimeText';
import EditIcon from '@spectrum-icons/workflow/Edit';
import ShareIcon from '@spectrum-icons/workflow/UserShare';
import { UseQueryResult } from '@tanstack/react-query';
import { InlineErrorComponent } from '@/generic/InlineErrorComponent';
import { RenamePopover } from './RenamePopover';
import { useMapDeleteMutation } from '@/features/map/api/useMapDeleteMutation';
import { MapShareDialog } from '@/features/map/MapShareDialog/MapShareDialog';
import Link from 'next/link';

export function MapsManagerSection({
  title,
  headerAction,
  renderEmptyState,
  query,
}: {
  title: string;
  headerAction?: ReactElement;
  renderEmptyState?: () => ReactElement;
  query: UseQueryResult<MapMeta[]>;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
  const selectedIds = () => {
    if (selectedKeys === 'all') {
      return query.data?.map((m) => m.id) ?? [];
    } else {
      return Array.from(selectedKeys.values()) as string[];
    }
  };
  const deleteMutation = useMapDeleteMutation();

  const isUpdating = query.isFetching || deleteMutation.isLoading;

  return (
    <section>
      <h2 className="flex justify-between mb-2">
        <span className="flex flex-row items-center">
          <span className="mr-2 text-base font-bold leading-6 text-gray-600">
            {title}
          </span>
          {isUpdating && (
            <ProgressCircle isIndeterminate aria-label="updating" size="S" />
          )}
        </span>
        <span>{headerAction}</span>
      </h2>

      {query.isError && <InlineErrorComponent error={query.error} />}

      <SelectionActionContainer
        selectedItemCount={selectedKeys === 'all' ? 'all' : selectedKeys.size}
        clearSelectedKeys={() => setSelectedKeys(new Set([]))}
        onDeleteAction={() => {
          deleteMutation.mutate({ list: selectedIds() });
          setSelectedKeys(new Set([]));
        }}
      >
        <TableView
          aria-label="maps"
          renderEmptyState={renderEmptyState}
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          flexGrow={1}
        >
          <TableHeader>
            <Column width="2fr">
              <ColumnText>Name</ColumnText>
            </Column>
            <Column align="end" width={200}>
              <ColumnText>Created at</ColumnText>
            </Column>
            <Column hideHeader>Rename</Column>
            <Column hideHeader>Share</Column>
          </TableHeader>
          <TableBody items={query.data || []}>
            {(item) => (
              <Row>
                <Cell textValue={item.name || 'Unnamed map'}>
                  <Link
                    href={`/map?id=${item.id}`}
                    className="inline-block w-full"
                  >
                    {item.name || (
                      <span className="italic text-neutral-700">
                        Unnamed map
                      </span>
                    )}
                  </Link>
                </Cell>
                <Cell>
                  <DateTimeText utc={item.createdAt} />
                </Cell>
                <Cell>
                  <RenameButton item={item} />
                </Cell>
                <Cell>
                  <ShareButton item={item} />
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      </SelectionActionContainer>
    </section>
  );
}

function RenameButton({ item }: { item: MapMeta }) {
  return (
    <DialogTrigger type="popover">
      <ActionButton aria-label="rename" isQuiet>
        <EditIcon />
      </ActionButton>
      {(close) => <RenamePopover close={close} item={item} />}
    </DialogTrigger>
  );
}

function ShareButton({ item }: { item: MapMeta }) {
  return (
    <DialogTrigger type="modal">
      <ActionButton aria-label="share" isQuiet>
        <ShareIcon />
      </ActionButton>
      {(close) => <MapShareDialog close={close} item={item} />}
    </DialogTrigger>
  );
}

function SelectionActionContainer({
  children,
  selectedItemCount,
  clearSelectedKeys,
  onDeleteAction,
}: {
  children: ReactElement;
  selectedItemCount: 'all' | number;
  clearSelectedKeys: () => void;
  onDeleteAction: () => void;
}) {
  return (
    <ActionBarContainer height="30rem">
      {children}
      <ActionBar
        selectedItemCount={selectedItemCount}
        onAction={(key) => {
          switch (key) {
            case 'delete':
              onDeleteAction();
              break;
          }
        }}
        onClearSelection={clearSelectedKeys}
        isEmphasized
      >
        <Item key="delete">Delete</Item>
      </ActionBar>
    </ActionBarContainer>
  );
}

function ColumnText({ children }: { children: ReactElement | string }) {
  return <span className="font-medium">{children}</span>;
}
