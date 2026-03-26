import type { LimitOrder, OrderId, ParticipantId, Price, Qty, Side, Trade } from "./types";

export interface AddOrderRequest {
  ownerId: ParticipantId;
  side: Side;
  price: Price;
  qty: Qty;
}

export interface OrderBookSnapshotLevel {
  price: Price;
  bidQty: Qty;
  askQty: Qty;
}

export interface OrderBookTop {
  bestBid?: { price: Price; qty: Qty };
  bestAsk?: { price: Price; qty: Qty };
}

export class OrderBook {
  private nowSeq = 0;
  private orderSeq = 0;
  private tradeSeq = 0;

  // price -> FIFO queue
  private bids = new Map<Price, LimitOrder[]>();
  private asks = new Map<Price, LimitOrder[]>();
  private byId = new Map<OrderId, { side: Side; price: Price }>();

  private bidPricesDesc: Price[] = [];
  private askPricesAsc: Price[] = [];

  private nextNow(): number {
    this.nowSeq += 1;
    return this.nowSeq;
  }

  private nextOrderId(): string {
    this.orderSeq += 1;
    return `O${this.orderSeq}`;
  }

  private nextTradeId(): string {
    this.tradeSeq += 1;
    return `T${this.tradeSeq}`;
  }

  top(): OrderBookTop {
    const bestBidPrice = this.bidPricesDesc[0];
    const bestAskPrice = this.askPricesAsc[0];

    const bestBidQty =
      bestBidPrice === undefined ? undefined : sumQty(this.bids.get(bestBidPrice) ?? []);
    const bestAskQty =
      bestAskPrice === undefined ? undefined : sumQty(this.asks.get(bestAskPrice) ?? []);

    return {
      bestBid:
        bestBidPrice === undefined ? undefined : { price: bestBidPrice, qty: bestBidQty ?? 0 },
      bestAsk:
        bestAskPrice === undefined ? undefined : { price: bestAskPrice, qty: bestAskQty ?? 0 }
    };
  }

  getOrder(orderId: OrderId): LimitOrder | undefined {
    const loc = this.byId.get(orderId);
    if (!loc) return undefined;
    const q = (loc.side === "buy" ? this.bids : this.asks).get(loc.price);
    return q?.find((o) => o.id === orderId);
  }

  cancel(orderId: OrderId): boolean {
    const loc = this.byId.get(orderId);
    if (!loc) return false;
    const sideMap = loc.side === "buy" ? this.bids : this.asks;
    const q = sideMap.get(loc.price);
    if (!q) return false;

    const idx = q.findIndex((o) => o.id === orderId);
    if (idx < 0) return false;

    q.splice(idx, 1);
    this.byId.delete(orderId);
    if (q.length === 0) this.removePriceLevel(loc.side, loc.price);
    return true;
  }

  cancelAllForOwner(ownerId: ParticipantId): OrderId[] {
    const cancelled: OrderId[] = [];
    for (const [orderId] of this.byId) {
      const o = this.getOrder(orderId);
      if (o && o.ownerId === ownerId) {
        if (this.cancel(orderId)) cancelled.push(orderId);
      }
    }
    return cancelled;
  }

  add(req: AddOrderRequest): { order?: LimitOrder; trades: Trade[] } {
    if (req.qty <= 0) throw new Error("qty must be > 0");
    const createdAt = this.nextNow();
    const id = this.nextOrderId();
    const incoming: LimitOrder = {
      id,
      ownerId: req.ownerId,
      side: req.side,
      price: req.price,
      qty: req.qty,
      createdAt
    };

    const trades: Trade[] = [];
    if (incoming.side === "buy") {
      this.matchBuy(incoming, trades);
      if (incoming.qty > 0) this.rest(incoming);
    } else {
      this.matchSell(incoming, trades);
      if (incoming.qty > 0) this.rest(incoming);
    }
    return { order: incoming.qty > 0 ? incoming : undefined, trades };
  }

  snapshot(depth = 8): OrderBookSnapshotLevel[] {
    const topBids = this.bidPricesDesc.slice(0, depth);
    const topAsks = this.askPricesAsc.slice(0, depth);
    const priceSet = new Set<Price>([...topBids, ...topAsks]);
    const prices = [...priceSet].sort((a, b) => b - a);

    return prices.map((p) => ({
      price: p,
      bidQty: sumQty(this.bids.get(p) ?? []),
      askQty: sumQty(this.asks.get(p) ?? [])
    }));
  }

  private rest(order: LimitOrder) {
    const sideMap = order.side === "buy" ? this.bids : this.asks;
    const q = sideMap.get(order.price);
    if (q) {
      q.push(order);
    } else {
      sideMap.set(order.price, [order]);
      this.byId.set(order.id, { side: order.side, price: order.price });
      this.insertPriceLevel(order.side, order.price);
      return;
    }
    this.byId.set(order.id, { side: order.side, price: order.price });
  }

  private matchBuy(buy: LimitOrder, trades: Trade[]) {
    while (buy.qty > 0) {
      const bestAskPrice = this.askPricesAsc[0];
      if (bestAskPrice === undefined) return;
      if (bestAskPrice > buy.price) return;

      const q = this.asks.get(bestAskPrice);
      if (!q || q.length === 0) {
        this.removePriceLevel("sell", bestAskPrice);
        continue;
      }

      const maker = q[0];
      const fillQty = Math.min(buy.qty, maker.qty);
      maker.qty -= fillQty;
      buy.qty -= fillQty;

      trades.push({
        id: this.nextTradeId(),
        price: maker.price,
        qty: fillQty,
        makerOrderId: maker.id,
        takerOwnerId: buy.ownerId,
        makerOwnerId: maker.ownerId,
        ts: this.nextNow()
      });

      if (maker.qty === 0) {
        q.shift();
        this.byId.delete(maker.id);
        if (q.length === 0) this.removePriceLevel("sell", bestAskPrice);
      }
    }
  }

  private matchSell(sell: LimitOrder, trades: Trade[]) {
    while (sell.qty > 0) {
      const bestBidPrice = this.bidPricesDesc[0];
      if (bestBidPrice === undefined) return;
      if (bestBidPrice < sell.price) return;

      const q = this.bids.get(bestBidPrice);
      if (!q || q.length === 0) {
        this.removePriceLevel("buy", bestBidPrice);
        continue;
      }

      const maker = q[0];
      const fillQty = Math.min(sell.qty, maker.qty);
      maker.qty -= fillQty;
      sell.qty -= fillQty;

      trades.push({
        id: this.nextTradeId(),
        price: maker.price,
        qty: fillQty,
        makerOrderId: maker.id,
        takerOwnerId: sell.ownerId,
        makerOwnerId: maker.ownerId,
        ts: this.nextNow()
      });

      if (maker.qty === 0) {
        q.shift();
        this.byId.delete(maker.id);
        if (q.length === 0) this.removePriceLevel("buy", bestBidPrice);
      }
    }
  }

  private insertPriceLevel(side: Side, price: Price) {
    if (side === "buy") {
      const arr = this.bidPricesDesc;
      if (arr.includes(price)) return;
      arr.push(price);
      arr.sort((a, b) => b - a);
    } else {
      const arr = this.askPricesAsc;
      if (arr.includes(price)) return;
      arr.push(price);
      arr.sort((a, b) => a - b);
    }
  }

  private removePriceLevel(side: Side, price: Price) {
    if (side === "buy") {
      this.bids.delete(price);
      this.bidPricesDesc = this.bidPricesDesc.filter((p) => p !== price);
    } else {
      this.asks.delete(price);
      this.askPricesAsc = this.askPricesAsc.filter((p) => p !== price);
    }
  }
}

function sumQty(q: LimitOrder[]): Qty {
  let s = 0;
  for (const o of q) s += o.qty;
  return s;
}

