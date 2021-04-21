import {
  defineComponent,
  ref,
  onMounted,
  PropType,
  onBeforeUnmount,
  h as rawH,
  isVue3,
} from "vue-demi";

export type ResponsiveImageType = {
  /** The aspect ratio (width/height) of the image */
  aspectRatio: number;
  /** A base64-encoded thumbnail to offer during image loading */
  base64?: string;
  /** The height of the image */
  height?: number;
  /** The width of the image */
  width: number;
  /** The HTML5 `sizes` attribute for the image */
  sizes?: string;
  /** The fallback `src` attribute for the image */
  src?: string;
  /** The HTML5 `srcSet` attribute for the image */
  srcSet?: string;
  /** The HTML5 `srcSet` attribute for the image in WebP format, for browsers that support the format */
  webpSrcSet?: string;
  /** The background color for the image placeholder */
  bgColor?: string;
  /** Alternate text (`alt`) for the image */
  alt?: string;
  /** Title attribute (`title`) for the image */
  title?: string;
};

const isSsr = typeof window === "undefined";

const isIntersectionObserverAvailable = isSsr
  ? false
  : !!(window as any).IntersectionObserver;

const universalBtoa = isSsr
  ? (str: string) => Buffer.from(str.toString(), "binary").toString("base64")
  : window.btoa;

const absolutePositioning = {
  position: "absolute",
  left: "0px",
  top: "0px",
  width: "100%",
  height: "100%",
};

type Vue2Data = Record<string, any>;

const h = (tag: string, data: Vue2Data | null, ...rest: any[]) => {
  if (isVue3) {
    let vue3Data = null;
    if (data) {
      const { attrs, on, ...other } = data;
      vue3Data = {
        ...other,
        ...attrs,
        ...Object.entries(on || {}).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [`on${key.charAt(0).toUpperCase() + key.slice(1)}`]: value,
          }),
          {}
        ),
      };
    }
    return rawH(tag, vue3Data, ...rest);
  }

  return rawH(tag, data, ...rest);
};

const useInView = ({ threshold, rootMargin }: IntersectionObserverInit) => {
  const observer = ref<IntersectionObserver | null>(null);
  const elRef = ref<HTMLElement | null>(null);
  const inView = ref(false);

  onMounted(() => {
    if (isIntersectionObserverAvailable) {
      observer.value = new IntersectionObserver(
        (entries) => {
          const image = entries[0];
          if (image.isIntersecting && observer.value) {
            inView.value = true;
            observer.value.disconnect();
          }
        },
        {
          threshold,
          rootMargin,
        }
      );
      if (elRef.value) {
        observer.value.observe(elRef.value);
      }
    }
  });

  onBeforeUnmount(() => {
    if (isIntersectionObserverAvailable && observer.value) {
      observer.value.disconnect();
    }
  });

  return { inView, elRef };
};

type State = {
  lazyLoad?: boolean;
  inView: boolean;
  loaded: boolean;
};

const imageAddStrategy = ({ lazyLoad, inView, loaded }: State) => {
  if (!lazyLoad) {
    return true;
  }

  if (isSsr) {
    return false;
  }

  if (isIntersectionObserverAvailable) {
    return inView || loaded;
  }

  return true;
};

const imageShowStrategy = ({ lazyLoad, loaded }: State) => {
  if (!lazyLoad) {
    return true;
  }

  if (isSsr) {
    return false;
  }

  if (isIntersectionObserverAvailable) {
    return loaded;
  }

  return true;
};

export const Image = defineComponent({
  name: "DatocmsImage",
  props: {
    /** The actual response you get from a DatoCMS `responsiveImage` GraphQL query */
    data: {
      type: Object as PropType<ResponsiveImageType>,
      required: true,
    },
    /** Additional CSS class for the image inside the `<picture />` tag */
    pictureClass: {
      type: String,
    },
    /** Duration (in ms) of the fade-in transition effect upoad image loading */
    fadeInDuration: {
      type: Number,
    },
    /** @deprecated Use the intersectionThreshold prop */
    intersectionTreshold: {
      type: Number,
      default: 0,
    },
    /** Indicate at what percentage of the placeholder visibility the loading of the image should be triggered. A value of 0 means that as soon as even one pixel is visible, the callback will be run. A value of 1.0 means that the threshold isn't considered passed until every pixel is visible */
    intersectionThreshold: {
      type: Number,
    },
    /** Margin around the placeholder. Can have values similar to the CSS margin property (top, right, bottom, left). The values can be percentages. This set of values serves to grow or shrink each side of the placeholder element's bounding box before computing intersections */
    intersectionMargin: {
      type: String,
      default: "0px 0px 0px 0px",
    },
    /** Wheter enable lazy loading or not */
    lazyLoad: {
      type: Boolean,
      default: true,
    },
    /** Additional CSS rules to add to the image inside the `<picture />` tag */
    pictureStyle: {
      type: Object,
      default: () => ({}),
    },
    /** Wheter the image wrapper should explicitely declare the width of the image or keep it fluid */
    explicitWidth: {
      type: Boolean,
    },
  },
  setup(props) {
    const loaded = ref(false);

    function handleLoad() {
      loaded.value = true;
    }

    const { inView, elRef } = useInView({
      threshold: props.intersectionThreshold || props.intersectionTreshold || 0,
      rootMargin: props.intersectionMargin || "0px 0px 0px 0px",
    });

    return {
      inView,
      elRef,
      loaded,
      handleLoad,
    };
  },
  render() {
    const addImage = imageAddStrategy({
      lazyLoad: this.lazyLoad,
      inView: this.inView,
      loaded: this.loaded,
    });

    const showImage = imageShowStrategy({
      lazyLoad: this.lazyLoad,
      inView: this.inView,
      loaded: this.loaded,
    });

    const webpSource =
      this.data.webpSrcSet &&
      h("source", {
        attrs: {
          srcset: this.data.webpSrcSet,
          sizes: this.data.sizes,
          type: "image/webp",
        },
      });

    const regularSource =
      this.data.srcSet &&
      h("source", {
        attrs: {
          srcset: this.data.srcSet,
          sizes: this.data.sizes,
        },
      });

    const transition =
      typeof this.fadeInDuration === "undefined" || this.fadeInDuration > 0
        ? `opacity ${this.fadeInDuration || 500}ms ${
            this.fadeInDuration || 500
          }ms`
        : undefined;

    const placeholder = h("div", {
      style: {
        backgroundImage: this.data.base64 ? `url(${this.data.base64})` : null,
        backgroundColor: this.data.bgColor,
        backgroundSize: "cover",
        opacity: showImage ? 0 : 1,
        transition: transition,
        ...absolutePositioning,
      },
    });

    const { width, aspectRatio } = this.data;

    const height = this.data.height || width / aspectRatio;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;

    const sizer = h("img", {
      class: this.pictureClass,
      style: {
        display: "block",
        width: this.explicitWidth ? `${width}px` : "100%",
        ...this.pictureStyle,
      },
      attrs: {
        src: `data:image/svg+xml;base64,${universalBtoa(svg)}`,
        role: "presentation",
      },
    });

    return h(
      "div",
      {
        style: {
          display: this.explicitWidth ? "inline-block" : "block",
          overflow: "hidden",
          position: "relative",
        },
        ref: "elRef",
      },
      [
        sizer,
        placeholder,
        addImage &&
          h("picture", null, [
            webpSource,
            regularSource,
            this.data.src &&
              h("img", {
                attrs: {
                  src: this.data.src,
                  alt: this.data.alt,
                  title: this.data.title,
                },
                on: {
                  load: this.handleLoad,
                },
                class: this.pictureClass,
                style: {
                  ...absolutePositioning,
                  ...this.pictureStyle,
                  opacity: showImage ? 1 : 0,
                  transition,
                },
              }),
          ]),
        h("noscript", null, [
          h("picture", null, [
            webpSource,
            regularSource,
            this.data.src &&
              h("img", {
                attrs: {
                  src: this.data.src,
                  alt: this.data.alt,
                  title: this.data.title,
                  loading: "lazy",
                },
                class: this.pictureClass,
                style: {
                  ...this.pictureStyle,
                  ...absolutePositioning,
                },
              }),
          ]),
        ]),
      ]
    );
  },
});

export const DatocmsImagePlugin = {
  install: (Vue: any) => {
    Vue.component("DatocmsImage", Image);
  },
};