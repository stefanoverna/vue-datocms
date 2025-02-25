import {
  defaultMetaTransformer,
  render,
  type RenderMarkRule,
  renderMarkRule,
  renderNodeRule,
  type TransformedMeta,
  type TransformMetaFn,
} from 'datocms-structured-text-generic-html-renderer';
import {
  type Document as StructuredTextDocument,
  isBlock,
  isInlineItem,
  isItemLink,
  isRoot,
  isStructuredText,
  type Node,
  type Record as StructuredTextGraphQlResponseRecord,
  RenderError,
  type RenderResult,
  type RenderRule,
  type StructuredText as StructuredTextGraphQlResponse,
  isInlineBlock,
} from 'datocms-structured-text-utils';
import { defineComponent, h, type PropType, type VNode } from 'vue';

export { renderNodeRule, renderMarkRule, RenderError };
// deprecated
export { renderNodeRule as renderRule };
export type { StructuredTextGraphQlResponse, StructuredTextDocument };

type AdapterReturn = VNode | string | null;

export const defaultAdapter = {
  renderNode: h,
  renderMark: h,
  renderFragment: (children: AdapterReturn[], _key: string): AdapterReturn =>
    children as any as AdapterReturn,
  renderText: (text: string, _key: string): AdapterReturn => text,
};

type H = typeof defaultAdapter.renderNode;
type T = typeof defaultAdapter.renderText;
type F = typeof defaultAdapter.renderFragment;

export function appendKeyToValidElement(
  element: AdapterReturn,
  key: string,
): AdapterReturn {
  if (
    element !== null &&
    typeof element !== 'string' &&
    (element as VNode).key === null
  ) {
    element.key = key;
  }

  return element;
}

export type RenderInlineRecordContext<
  R extends
    StructuredTextGraphQlResponseRecord = StructuredTextGraphQlResponseRecord,
> = {
  record: R;
};

export type RenderRecordLinkContext<
  R extends
    StructuredTextGraphQlResponseRecord = StructuredTextGraphQlResponseRecord,
> = {
  record: R;
  children: RenderResult<H, T, F>[];
  transformedMeta: TransformedMeta;
};

export type RenderBlockContext<
  R extends
    StructuredTextGraphQlResponseRecord = StructuredTextGraphQlResponseRecord,
> = {
  record: R;
};

export const StructuredText = defineComponent({
  name: 'DatocmsStructuredText',

  props: {
    /** The actual field value you get from DatoCMS **/
    data: {
      type: Object as PropType<
        | StructuredTextGraphQlResponse
        | StructuredTextDocument
        | Node
        | null
        | undefined
      >,
    },
    /** @deprecated use customNodeRules **/
    customRules: {
      type: Array as PropType<RenderRule<H, T, F>[]>,
    },
    /** A set of additional rules to convert the document to JSX **/
    customNodeRules: {
      type: Array as PropType<RenderRule<H, T, F>[]>,
    },
    /** A set of additional rules to convert the document to JSX **/
    customMarkRules: {
      type: Array as PropType<RenderMarkRule<H, T, F>[]>,
    },
    /** Fuction that converts an 'inlineItem' node into a Vue component **/
    renderInlineRecord: {
      type: Function as PropType<
        (context: RenderInlineRecordContext<any>) => AdapterReturn
      >,
    },
    /** Fuction that converts an 'itemLink' node into a Vue component **/
    renderLinkToRecord: {
      type: Function as PropType<
        (context: RenderRecordLinkContext<any>) => AdapterReturn
      >,
    },
    /** Fuction that converts a 'block' node into a Vue component **/
    renderBlock: {
      type: Function as PropType<
        (context: RenderBlockContext<any>) => AdapterReturn
      >,
    },
    /** Fuction that converts an 'inlineBlock' node into a Vue component **/
    renderInlineBlock: {
      type: Function as PropType<
        (context: RenderBlockContext<any>) => AdapterReturn
      >,
    },
    /** Function that converts 'link' and 'itemLink' `meta` into HTML props */
    metaTransformer: { type: Function as PropType<TransformMetaFn> },
    /** Fuction that converts a simple string text into a Vue component **/
    renderText: { type: Function as PropType<T> },
    /** React.createElement-like function to use to convert a node into a Vue component **/
    renderNode: { type: Function as PropType<H> },
    /** Function to use to generate a Vue.Fragment **/
    renderFragment: { type: Function as PropType<F> },
  },

  setup(props) {
    return () => {
      return render(props.data, {
        adapter: {
          renderText: props.renderText || defaultAdapter.renderText,
          renderNode: props.renderNode || defaultAdapter.renderNode,
          renderFragment: props.renderFragment || defaultAdapter.renderFragment,
        },
        metaTransformer: props.metaTransformer,
        customMarkRules: props.customMarkRules,
        customNodeRules: [
          renderNodeRule(
            isRoot,
            ({ adapter: { renderNode }, key, children }) => {
              return renderNode('div', { key }, children);
            },
          ),
          renderNodeRule(isInlineItem, ({ node, key }) => {
            if (!props.renderInlineRecord) {
              throw new RenderError(
                `The Structured Text document contains an 'inlineItem' node, but no 'renderInlineRecord' prop is specified!`,
                node,
              );
            }

            if (!isStructuredText(props.data) || !props.data.links) {
              throw new RenderError(
                `The Structured Text document contains an 'inlineItem' node, but .links is not present!`,
                node,
              );
            }

            const item = props.data.links.find((item) => item.id === node.item);

            if (!item) {
              throw new RenderError(
                `The Structured Text document contains an 'inlineItem' node, but cannot find a record with ID ${node.item} inside .links!`,
                node,
              );
            }

            return appendKeyToValidElement(
              props.renderInlineRecord({ record: item }),
              key,
            );
          }),
          renderNodeRule(isItemLink, ({ node, key, children }) => {
            if (!props.renderLinkToRecord) {
              throw new RenderError(
                `The Structured Text document contains an 'itemLink' node, but no 'renderLinkToRecord' prop is specified!`,
                node,
              );
            }

            if (!isStructuredText(props.data) || !props.data.links) {
              throw new RenderError(
                `The Structured Text document contains an 'itemLink' node, but .links is not present!`,
                node,
              );
            }

            const item = props.data.links.find((item) => item.id === node.item);

            if (!item) {
              throw new RenderError(
                `The Structured Text document contains an 'itemLink' node, but cannot find a record with ID ${node.item} inside .links!`,
                node,
              );
            }

            return appendKeyToValidElement(
              props.renderLinkToRecord({
                record: item,
                children: children as any as AdapterReturn[],
                transformedMeta: node.meta
                  ? (props.metaTransformer || defaultMetaTransformer)({
                      node,
                      meta: node.meta,
                    })
                  : null,
              }),
              key,
            );
          }),
          renderNodeRule(isBlock, ({ node, key }) => {
            if (!props.renderBlock) {
              throw new RenderError(
                `The Structured Text document contains a 'block' node, but no 'renderBlock' prop is specified!`,
                node,
              );
            }

            if (!isStructuredText(props.data) || !props.data.blocks) {
              throw new RenderError(
                `The Structured Text document contains a 'block' node, but .blocks is not present!`,
                node,
              );
            }

            const item = props.data.blocks.find(
              (item) => item.id === node.item,
            );

            if (!item) {
              throw new RenderError(
                `The Structured Text document contains a 'block' node, but cannot find a record with ID ${node.item} inside .blocks!`,
                node,
              );
            }

            return appendKeyToValidElement(
              props.renderBlock({ record: item }),
              key,
            );
          }),
          renderNodeRule(isInlineBlock, ({ node, key }) => {
            if (!props.renderInlineBlock) {
              throw new RenderError(
                `The Structured Text document contains an 'inlineBlock' node, but no 'renderInlineBlock' prop is specified!`,
                node,
              );
            }

            if (!isStructuredText(props.data) || !props.data.blocks) {
              throw new RenderError(
                `The Structured Text document contains an 'inlineBlock' node, but .blocks is not present!`,
                node,
              );
            }

            const item = props.data.blocks.find(
              (item) => item.id === node.item,
            );

            if (!item) {
              throw new RenderError(
                `The Structured Text document contains a 'block' node, but cannot find a record with ID ${node.item} inside .blocks!`,
                node,
              );
            }

            return appendKeyToValidElement(
              props.renderInlineBlock({ record: item }),
              key,
            );
          }),
          ...(props.customNodeRules || props.customRules || []),
        ],
      });
    };
  },
});

export const DatocmsStructuredTextPlugin = {
  install: (Vue: any) => {
    Vue.component('DatocmsStructuredText', StructuredText);
  },
};
