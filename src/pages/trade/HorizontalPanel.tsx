import { useCallback, useMemo, useState } from 'react';

import { shallowEqual, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { STRING_KEYS } from '@/constants/localization';
import { AppRoute } from '@/constants/routes';

import { useBreakpoints, useStringGetter } from '@/hooks';

import { AssetIcon } from '@/components/AssetIcon';
import { CollapsibleTabs } from '@/components/CollapsibleTabs';
import { LoadingSpinner } from '@/components/Loading/LoadingSpinner';
import { MobileTabs } from '@/components/Tabs';
import { Tag, TagType } from '@/components/Tag';
import { ToggleGroup } from '@/components/ToggleGroup';
import { PositionInfo } from '@/views/PositionInfo';
import { FillsTable, FillsTableColumnKey } from '@/views/tables/FillsTable';
import { OrdersTable, OrdersTableColumnKey } from '@/views/tables/OrdersTable';
import { PositionsTable, PositionsTableColumnKey } from '@/views/tables/PositionsTable';

import {
  calculateHasUncommittedOrders,
  calculateIsAccountViewOnly,
  calculateShouldRenderActionsInPositionsTable,
  calculateShouldRenderTriggersInPositionsTable,
} from '@/state/accountCalculators';
import {
  getCurrentMarketTradeInfoNumbers,
  getHasUnseenFillUpdates,
  getHasUnseenOrderUpdates,
  getTradeInfoNumbers,
} from '@/state/accountSelectors';
import { getDefaultToAllMarketsInPositionsOrdersFills } from '@/state/configsSelectors';
import { getCurrentMarketAssetId, getCurrentMarketId } from '@/state/perpetualsSelectors';

import { isTruthy } from '@/lib/isTruthy';
import { shortenNumberForDisplay } from '@/lib/numbers';
import { testFlags } from '@/lib/testFlags';

import { UnopenedIsolatedPositions } from './UnopenedIsolatedPositions';

enum InfoSection {
  Position = 'Position',
  Orders = 'Orders',
  Fills = 'Fills',
  Payments = 'Payments',
}

enum PanelView {
  AllMarkets = 'AllMarkets',
  CurrentMarket = 'CurrentMarket',
}

type ElementProps = {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
};

export const HorizontalPanel = ({ isOpen = true, setIsOpen }: ElementProps) => {
  const stringGetter = useStringGetter();
  const navigate = useNavigate();
  const { isTablet } = useBreakpoints();

  const allMarkets = useSelector(getDefaultToAllMarketsInPositionsOrdersFills);
  const [view, setView] = useState<PanelView>(
    allMarkets ? PanelView.AllMarkets : PanelView.CurrentMarket
  );
  const [tab, setTab] = useState<InfoSection>(InfoSection.Position);

  const currentMarketId = useSelector(getCurrentMarketId);
  const currentMarketAssetId = useSelector(getCurrentMarketAssetId);

  const { numTotalPositions, numTotalOpenOrders, numTotalFills } =
    useSelector(getTradeInfoNumbers, shallowEqual) || {};

  const { numOpenOrders, numFills } =
    useSelector(getCurrentMarketTradeInfoNumbers, shallowEqual) || {};

  const showClosePositionAction = true;

  const hasUnseenOrderUpdates = useSelector(getHasUnseenOrderUpdates);
  const hasUnseenFillUpdates = useSelector(getHasUnseenFillUpdates);
  const isAccountViewOnly = useSelector(calculateIsAccountViewOnly);
  const shouldRenderTriggers = useSelector(calculateShouldRenderTriggersInPositionsTable);
  const shouldRenderActions = useSelector(
    calculateShouldRenderActionsInPositionsTable(showClosePositionAction)
  );
  const isWaitingForOrderToIndex = useSelector(calculateHasUncommittedOrders);
  const showCurrentMarket = isTablet || view === PanelView.CurrentMarket;

  const fillsTagNumber = shortenNumberForDisplay(showCurrentMarket ? numFills : numTotalFills);
  const ordersTagNumber = shortenNumberForDisplay(
    showCurrentMarket ? numOpenOrders : numTotalOpenOrders
  );

  const onViewOrders = useCallback((market: string) => {
    navigate(`${AppRoute.Trade}/${market}`, {
      state: {
        from: AppRoute.Trade,
      },
    });
    setView(PanelView.CurrentMarket);
    setTab(InfoSection.Orders);
  }, []);

  const tabItems = useMemo(
    () => [
      {
        value: InfoSection.Position,
        label: stringGetter({
          key: showCurrentMarket ? STRING_KEYS.POSITION : STRING_KEYS.POSITIONS,
        }),

        tag: showCurrentMarket ? null : shortenNumberForDisplay(numTotalPositions),

        content: isTablet ? (
          <PositionInfo showNarrowVariation={isTablet} />
        ) : (
          <PositionsTable
            currentMarket={showCurrentMarket ? currentMarketId : undefined}
            columnKeys={
              isTablet
                ? [
                    PositionsTableColumnKey.Details,
                    PositionsTableColumnKey.IndexEntry,
                    PositionsTableColumnKey.PnL,
                  ]
                : [
                    PositionsTableColumnKey.Market,
                    PositionsTableColumnKey.Side,
                    PositionsTableColumnKey.Size,
                    PositionsTableColumnKey.Leverage,
                    PositionsTableColumnKey.LiquidationAndOraclePrice,
                    testFlags.isolatedMargin && PositionsTableColumnKey.Margin,
                    PositionsTableColumnKey.UnrealizedPnl,
                    PositionsTableColumnKey.RealizedPnl,
                    PositionsTableColumnKey.AverageOpenAndClose,
                    PositionsTableColumnKey.NetFunding,
                    shouldRenderTriggers && PositionsTableColumnKey.Triggers,
                    shouldRenderActions && PositionsTableColumnKey.Actions,
                  ].filter(isTruthy)
            }
            showClosePositionAction={showClosePositionAction}
            onNavigate={() => setView(PanelView.CurrentMarket)}
            navigateToOrders={onViewOrders}
          />
        ),
      },
      {
        asChild: true,
        value: InfoSection.Orders,
        label: stringGetter({ key: STRING_KEYS.ORDERS }),

        slotRight: isWaitingForOrderToIndex ? (
          <Styled.LoadingSpinner />
        ) : (
          ordersTagNumber && (
            <Tag type={TagType.Number} isHighlighted={hasUnseenOrderUpdates}>
              {ordersTagNumber}
            </Tag>
          )
        ),

        content: (
          <OrdersTable
            currentMarket={showCurrentMarket ? currentMarketId : undefined}
            columnKeys={
              isTablet
                ? [OrdersTableColumnKey.StatusFill, OrdersTableColumnKey.PriceType]
                : [
                    !showCurrentMarket && OrdersTableColumnKey.Market,
                    OrdersTableColumnKey.Status,
                    OrdersTableColumnKey.Side,
                    OrdersTableColumnKey.AmountFill,
                    OrdersTableColumnKey.Price,
                    OrdersTableColumnKey.Trigger,
                    OrdersTableColumnKey.GoodTil,
                    !isAccountViewOnly && OrdersTableColumnKey.Actions,
                  ].filter(isTruthy)
            }
          />
        ),
      },
      {
        asChild: true,
        value: InfoSection.Fills,
        label: stringGetter({ key: STRING_KEYS.FILLS }),

        slotRight: fillsTagNumber && (
          <Tag type={TagType.Number} isHighlighted={hasUnseenFillUpdates}>
            {fillsTagNumber}
          </Tag>
        ),

        content: (
          <FillsTable
            currentMarket={showCurrentMarket ? currentMarketId : undefined}
            columnKeys={
              isTablet
                ? [
                    FillsTableColumnKey.Time,
                    FillsTableColumnKey.TypeAmount,
                    FillsTableColumnKey.PriceFee,
                  ]
                : [
                    !showCurrentMarket && FillsTableColumnKey.Market,
                    FillsTableColumnKey.Time,
                    FillsTableColumnKey.Type,
                    FillsTableColumnKey.Side,
                    FillsTableColumnKey.AmountTag,
                    FillsTableColumnKey.Price,
                    FillsTableColumnKey.TotalFee,
                    FillsTableColumnKey.Liquidity,
                  ].filter(isTruthy)
            }
            columnWidths={{
              [FillsTableColumnKey.TypeAmount]: '100%',
            }}
          />
        ),
      },
      // TODO - TRCL-1693 - re-enable when funding payments are supported
      // {
      //   value: InfoSection.Payments,
      //   label: stringGetter({ key: STRING_KEYS.PAYMENTS }),

      //   tag: shortenNumberForDisplay(
      //     showCurrentMarket ? numFundingPayments : numTotalFundingPayments
      //   ),
      //   content: (
      //     <FundingPaymentsTable currentMarket={showCurrentMarket ? currentMarket?.id : undefined} />
      //   ),
      // },
    ],
    [
      stringGetter,
      currentMarketId,
      showCurrentMarket,
      isTablet,
      isWaitingForOrderToIndex,
      isAccountViewOnly,
      ordersTagNumber,
      fillsTagNumber,
      hasUnseenFillUpdates,
      hasUnseenOrderUpdates,
    ]
  );

  const slotBottom = {
    [InfoSection.Position]: testFlags.isolatedMargin && (
      <UnopenedIsolatedPositions onViewOrders={onViewOrders} />
    ),
    [InfoSection.Orders]: null,
    [InfoSection.Fills]: null,
    [InfoSection.Payments]: null,
  }[tab];

  return isTablet ? (
    <MobileTabs defaultValue={InfoSection.Position} items={tabItems} withBorders={false} />
  ) : (
    <>
      <Styled.CollapsibleTabs
        defaultTab={InfoSection.Position}
        tab={tab}
        setTab={setTab}
        defaultOpen={isOpen}
        onOpenChange={setIsOpen}
        slotToolbar={
          <ToggleGroup
            items={[
              {
                value: PanelView.AllMarkets,
                label: stringGetter({ key: STRING_KEYS.ALL }),
              },
              {
                value: PanelView.CurrentMarket,
                ...(currentMarketAssetId
                  ? {
                      slotBefore: <Styled.AssetIcon symbol={currentMarketAssetId} />,
                      label: currentMarketAssetId,
                    }
                  : { label: stringGetter({ key: STRING_KEYS.MARKET }) }),
              },
            ]}
            value={view}
            onValueChange={setView}
            onInteraction={() => {
              setIsOpen?.(true);
            }}
          />
        }
        tabItems={tabItems}
      />
      {slotBottom}
    </>
  );
};

const Styled = {
  AssetIcon: styled(AssetIcon)`
    font-size: 1.5em;
  `,
  CollapsibleTabs: styled(CollapsibleTabs)`
    --tableHeader-backgroundColor: var(--color-layer-3);

    header {
      background-color: var(--color-layer-2);
    }
  ` as typeof CollapsibleTabs<InfoSection>,
  LoadingSpinner: styled(LoadingSpinner)`
    --spinner-width: 1rem;
  `,
};
