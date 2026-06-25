/**
 * The interaction-kit component registry: one React component per `WidgetKind`,
 * conforming to WS-A's `WidgetProps` contract. WS-E/WS-F inject this map into
 * `WidgetHost` (`components={WIDGET_COMPONENTS}`) and wrap the rendered layout in the
 * data providers below (seeded from the spec's dataRef) so the chart family shares one
 * real candle slice / option chain.
 */
import type { WidgetComponents } from '../WidgetHost'
import Narrative from './Narrative'
import NewsHeadline from './NewsHeadline'
import CandleChart from './CandleChart'
import AnnotateChart from './AnnotateChart'
import DirectionChoice from './DirectionChoice'
import PriceLines from './PriceLines'
import SizeSlider from './SizeSlider'
import RiskSlider from './RiskSlider'
import Confidence from './Confidence'
import MultipleChoice from './MultipleChoice'
import OptionLegBuilder from './OptionLegBuilder'
import PayoffGraph from './PayoffGraph'
import QuoteLadder from './QuoteLadder'
import Checklist from './Checklist'

/** Every `WidgetKind` → its component (the map `WidgetHost` renders from). */
export const WIDGET_COMPONENTS: WidgetComponents = {
  narrative: Narrative,
  'news-headline': NewsHeadline,
  'candle-chart': CandleChart,
  'annotate-chart': AnnotateChart,
  'direction-choice': DirectionChoice,
  'price-lines': PriceLines,
  'size-slider': SizeSlider,
  'risk-slider': RiskSlider,
  confidence: Confidence,
  'multiple-choice': MultipleChoice,
  'option-leg-builder': OptionLegBuilder,
  'payoff-graph': PayoffGraph,
  'quote-ladder': QuoteLadder,
  checklist: Checklist,
}

// Data providers + hooks WS-E/WS-F wrap a rendered layout in.
export {
  ChartDataProvider,
  ChainDataProvider,
  LegsProvider,
  useCandles,
  useChain,
  useLegs,
  useResolvedCandles,
  useResolvedChain,
} from './context'

// Pure helpers (reused by other workstreams / tests).
export { makeChartScale, priceRange, type ChartScale } from './chartScale'
export { rewardRisk } from './rewardRisk'
export { quoteFromMid, ladderLevels } from './quoteMath'
export { rowToLeg, definedRisk } from './legBuilder'
export { payoffSummary, payoffSamples, combinedDollars } from './payoffCurve'
