 /**
 * Implements ToonTalk's interface to HTML elements
 * Authors: Ken Kahn
 * License: New BSD
 */

/*jslint browser: true, devel: true, plusplus: true, vars: true, white: true */
/*global $, BigInteger, bigrat */

(function () {
    
// this internal function is need by both element and element_backside
var is_transformation_option = function (attribute) {
    return (attribute === 'rotate' || attribute === 'skewX' || attribute === 'skewY' || attribute === 'transform-origin-x' || attribute === 'transform-origin-y');
};

window.TOONTALK.element = (function (TT) { // TT is for convenience and more legible code
    "use strict";

    var attributes_needing_updating = ["left", "top", "width", "height"];
    
    var element = Object.create(TT.widget);
    
    var value_in_pixels = function (value, attribute) {
        var last_character, number;
        if (!value) {
            return 0;
        }
        if (typeof value === 'number') {
            number = value;
        }
        if (value.length === 0) {
            number = 0;
        }
        if (typeof number === 'undefined') {
            last_character = value.substring(value.length-1);
            if ("0123456789x".indexOf(last_character) >= 0) {
                // assumes that the only CSS units ending in 'x' is 'px'
                number = parseFloat(value);
                if (isNaN(number)) {
                    return; // undefined
                }
            }
        }
        return canonicalise_value(number, attribute);
    };
    
    var canonicalise_value = function (value, attribute) {
        var new_value;
        if (["rotate", "skewX", "skewY"].indexOf(attribute) >= 0) {
            // ensure the value is between 0 and 360
            new_value = value % 360;
            if (new_value < 0) {
                new_value += 360;
            }
            return new_value;
        }
        return value;
    };
    
    element.create = function (html, style_attributes, description, additional_classes) {
        var new_element = Object.create(element);
        var widget_drag_started = new_element.drag_started;
        var attribute_widgets_in_backside_table = {}; // table relating attribute_name and widget in backside table
        var original_copies                     = {}; // table relating attribute_name and all the widget copies for that attribute
        var original_width, original_height, current_width, current_height, pending_css, transform_css, on_update_display_handlers, $image_element;
        if (!style_attributes) {
            style_attributes = [];
        }
        new_element.is_element = function () {
            return true;
        };
        new_element.get_HTML = function () {
            return html;
        };
        new_element.get_text = function () {
            var text = this.get_frontside_element().textContent;
            if (text === "") {
                return this.get_HTML();
            }
            return text;
        };
        new_element.set_HTML = function (new_value) {
            var frontside_element = this.get_frontside_element();
            if (!frontside_element) {
                return false;
            }
            if (html === new_value) {
                return false;
            }
            html = new_value;
            // remove children so will be updated
            $(frontside_element).children(":not(.ui-resizable-handle)").remove(); 
            this.rerender();
            return true;
        };
        new_element.set_text = function (new_value) {
            var frontside_element = this.get_frontside_element();
            var set_first_text_node = function (element) {
                $(element).contents().each(function () {
                    if (this.nodeType == Node.TEXT_NODE) {
                        this.textContent = new_value;
                        new_value = ""; // empty the other ones
                    } else {
                        set_first_text_node(this, new_value);
                    }
                });
            }
            if (!frontside_element) {
                return false;
            }
            if (new_value === frontside_element.textContent) {
                return false;
            }
            set_first_text_node(frontside_element);
            return this.set_HTML(frontside_element.innerHTML);
//             $(frontside_element).text(new_value);
//             text = this.get_text().trim();
//             return this.set_HTML(html.replace(text, new_value));
        };
        new_element.get_style_attributes = function () {
            return style_attributes;
        };
        new_element.set_style_attributes = function (new_value) {
            style_attributes = new_value;
        };
        new_element.get_attribute_widgets_in_backside_table = function () {
            return attribute_widgets_in_backside_table;
        };
        new_element.get_original_copies = function () {
            return original_copies;
        };
        new_element.get_pending_css = function () {
            return pending_css;
        };
        new_element.get_transform_css = function () {
            return transform_css;
        };
        new_element.add_to_css = function (attribute, value) {
            if (is_transformation_option(attribute)) {
                // could remove attribute if value is 0
                if (!transform_css) {
                    transform_css = {};
                }
                transform_css[attribute] = value;
                return;
            }
            if (!pending_css) {
                pending_css = {};
            }
            pending_css[attribute] = value;
        };
        new_element.apply_css = function () {
            var transform = "";
            var frontside_element, need_to_scale, x_scale, y_scale, child_css, $container, container_width, container_height;
            if (!pending_css && !transform_css) {
                return;
            }
            frontside_element = this.get_frontside_element();
            if (!frontside_element) {
                return;
            }
            if (!$(frontside_element).is(":visible")) {
                // not yet visible so postpone
                TT.UTILITIES.set_timeout(function () {
                    this.apply_css();
                }.bind(this),
                100);
                return;
            }
            if (pending_css) {
                if (pending_css.width) {
                    current_width  = pending_css.width;
                    need_to_scale = true;
                }
                if (pending_css.height) {
                    current_height = pending_css.height;
                    need_to_scale = true;
                }
            }
            if (transform_css) {
                if (!child_css) {
                    child_css = {};
                }
                if (transform_css['rotate']) {
                    transform += 'rotate(' + transform_css['rotate'] + 'deg)';
                }
                if (transform_css['skewX']) {
                    transform += 'skewX(' + transform_css['skewX'] + 'deg)';
                }
                if (transform_css['skewY']) {
                    transform += 'skewY(' + transform_css['skewY'] + 'deg)';
                }
                if (transform_css['transform-origin-x'] || transform_css['transform-origin-y']) {
                    pending_css['transform-origin'] = (transform_css['transform-origin-x'] || 0) + ' ' + (transform_css['transform-origin-y'] || 0);
                }
//                 need_to_scale = false; // no need since scaling right here
//                 x_scale =  (current_width /(original_width  || $(frontside_element).width()));
//                 y_scale =  (current_height/(original_height || $(frontside_element).height()));
//                transform += 'scale(' + (x_scale || 1) + ', ' + (y_scale || 1) + ')';
                if (!pending_css || !pending_css['transform-origin']) {
//                     if (this === TT.UTILITIES.get_dragee()) {
//                         // other origins cause drag and drop to behave strangely
//                         child_css['transform-origin'] = "left top";
//                     } else {
                        child_css['transform-origin'] = "center center";
//                     }
                }
                if (transform) {
                    child_css['-webkit-transform'] = transform;
                    child_css['-moz-transform']    = transform;
                    child_css['-ms-transform']     = transform;
                    child_css['o-transform']       = transform;
                    child_css['transform']         = transform;
                    // transform the child since can't have different transform-origins in the same element transforms
                    $(frontside_element).children(".toontalk-element-container").css(child_css);
                }
            };
            // need to delay the following since width and height may not be known yet
            TT.UTILITIES.set_timeout(function () {
                if (!pending_css) {
                    // can be undefined if all the transforms had a zero value
                    return;
                }
                if (current_width || current_height) {
                    // if it contains an image then change it too (needed only for width and height)
                    // TODO: is the following still needed?
                    if ($image_element) {
                        $image_element.css({width:  original_width,
                                            height: original_height});
                    }
                    // tried $(frontside_element).children(".toontalk-element-container").get(0)
                    $(frontside_element).children(".toontalk-element-container").css({width: '', height: ''});
                    if (need_to_scale) {
                        TT.UTILITIES.run_when_dimensions_known(frontside_element,
                                                                   function () {
                                                                        TT.UTILITIES.scale_element(frontside_element, current_width, current_height, original_width, original_height);
                                                                   });
                    }
                    pending_css.width  = undefined;
                    pending_css.height = undefined;    
                }
                if (pending_css.left || pending_css.top) {
                    // elements (like turtles) by default wrap -- TODO: make this configurable
                    if (pending_css.left) {      
                        // if negative after mod add width -- do another mod in case was positive
                        $container = $(this.get_parent_of_frontside().get_element());
                        container_width = $container.width();
                        pending_css.left = ((pending_css.left%container_width)+container_width)%container_width;
                    }
                    if (pending_css.top) {
                        if (!$container) {
                            $container = $(this.get_parent_of_frontside().get_element());
                        }
                        container_height = $container.height();
                        pending_css.top = ((pending_css.top%container_height)+container_height)%container_height;
                    }
                }
                $(frontside_element).css(pending_css);
                pending_css = undefined;
                }.bind(this));
        };
        new_element.on_update_display = function (handler) {
            if (!on_update_display_handlers) {
                on_update_display_handlers = [handler];
            } else {
                on_update_display_handlers.push(handler);
            }
        };
        new_element.fire_on_update_display_handlers = function () {
            if (on_update_display_handlers) {
                TT.UTILITIES.set_timeout(function () {
                        on_update_display_handlers.forEach(function (handler, index) {
                            if (!handler()) {
                                // transient handler
                                on_update_display_handlers.splice(index, 1);
                            };
                        });
                    });   
            }
        };
        new_element.get_image_element = function () {
            return $image_element;
        };
        new_element.set_image_element = function (element, frontside_element) {
            $image_element = $(element).find("img");
            if ($image_element.length === 0) {
                $image_element = undefined;
            } else {
                // make sure that the front side has the same dimensions as its image
                $(frontside_element).width( $image_element.width());
                $(frontside_element).height($image_element.height());
            }
        };
        new_element.get_additional_classes = function () {
            return additional_classes;
        };
        new_element.set_additional_classes = function (new_value) {
            additional_classes = new_value;
        };
        new_element = new_element.add_standard_widget_functionality(new_element);
        new_element.drag_started = function (json, is_resource) {
            this.drag_x_offset = json.view.drag_x_offset;
            this.drag_y_offset = json.view.drag_y_offset;
            widget_drag_started.call(this, json, is_resource);
        };
        new_element.update_display = function () {
            var frontside_element = this.get_frontside_element();
            var backside = this.get_backside();
            var element_description = function (element) {
                if (this.get_image_element()) {
                    return "image";
                }
                if ($(element).is(".toontalk-plain-text-element")) {
                    return "text";
                }
                return "element";
            }.bind(this);
            if (this.being_dragged) {
                return;
            }
            if (this.get_erased()) {
                var width, height;
                if ($(frontside_element).parent(".toontalk-backside").is("*")) {
                    width = "";
                    height = "";
                } else {
                    width = "100%";
                    height = "100%";
                }
                this.save_dimensions();
                $(frontside_element).removeClass() // remove them all
                                    .empty()
                                    .addClass("toontalk-erased-element toontalk-side")
                                    .css({width:  width,
                                          height: height});
                if ($(frontside_element).parent(".toontalk-conditions-contents-container").is("*")) {
                    frontside_element.title = "This is an element that has been erased. It will match any element.";
                } else {
                    frontside_element.title = "This is an erased element. It will replace its HTML with the HTML of the element you drop on it.";            
                }
                return;
            }
            if ($(frontside_element).is(".toontalk-erased-element")) {
                // was erased but no longer
                $(frontside_element).removeClass("toontalk-erased-element");
                this.restore_dimensions();
            }
            this.initialise_element();
            if (TT.UTILITIES.on_a_nest_in_a_box(frontside_element)) {
                // need to work around a CSS problem where nested percentage widths don't behave as expected
                this.set_attribute('width',  $(frontside_element).closest(".toontalk-box-hole").width(),  false);
                this.set_attribute('height', $(frontside_element).closest(".toontalk-box-hole").height(), false);
            }
            if (typeof original_width === 'undefined') {
                // this delays but the following delays more
                TT.UTILITIES.original_dimensions(this, function (width, height) {
                                                           original_width  = width;
                                                           original_height = height;
                                                       });
            }
            this.apply_css();
            this.fire_on_update_display_handlers();
            frontside_element.title = "Click to see the backside where you can place robots or change the style of this " + element_description(frontside_element) + ".";
        };
        new_element.initialise_element = function () {
            var frontside_element = this.get_frontside_element();
            var rendering, additional_classes;
            if (frontside_element.children.length === $(frontside_element).children(".ui-resizable-handle").length) {
                // the only children are resize handles so add the HTML
                rendering = document.createElement('div');
                $(rendering).addClass("toontalk-element-container");
                rendering.innerHTML = this.get_HTML();
                frontside_element.appendChild(rendering);
                this.set_image_element(rendering, frontside_element);
                $(frontside_element).addClass("toontalk-element-frontside");
                if (rendering.innerHTML.substring(0, 1) !== '<') {
                    // doesn't look like HTML so assume it is raw text and give it a class that will give it a better font and size
                    additional_classes = this.get_additional_classes();
                    if (additional_classes) {
                        $(rendering).addClass(additional_classes);
                    }
                    $(frontside_element).addClass("ui-widget toontalk-plain-text-element");
                }
            }
        };
        new_element.get_attribute_from_current_css = function (attribute) {
            var frontside_element, value;
            if (attribute === 'width' && (current_width || original_width)) {
                return current_width || original_width;
            }
            if (attribute === 'height' && (current_height || original_height)) {
                return current_height || original_height;
            }
            frontside_element = this.get_frontside_element();
            value = frontside_element.style[attribute];
            if (value === "") {
                // this caused integer rounding (at least of font-size)
                // but if the above doesn't find a value seems sometimes this does
                value = $(frontside_element).css(attribute);
            }
            if (!value) {
                // zero is the default value -- e.g. for transformations such as rotate
                return 0;
            }
            if (typeof value === 'number') {
                return value;
            }
            // should really check that px is at the end the rest is a number
            return value.replace("px", "");
        };
        new_element.get_original_width = function () {
            return original_width;
        };
        new_element.get_original_height = function () {
            return original_height;
        };
        new_element.increment_width = function (delta) {
//          console.log("delta: " + delta + " new width: " + ((current_width  || original_width) + delta));
            this.set_attribute('width',  (current_width  || original_width)  + delta);
        };
        new_element.increment_height = function (delta) {
            this.set_attribute('height', (current_height || original_height) + delta);
        };
        new_element.set_description(description);
        if (TT.debugging) {
            new_element.debug_string = new_element.toString();
            new_element.debug_id = TT.UTILITIES.generate_unique_id();
        }
        return new_element;
    };
    
    element.copy = function (parameters) {
        // copy has a copy of the attributes array as well
        var copy = element.create(this.get_HTML(), this.get_style_attributes().slice(), this.get_description());
        return this.add_to_copy(copy, parameters);
    };
    
    element.match = function (other) {
        if (this.get_erased && this.get_erased()) {
            if (other.match_with_any_element) {
                return other.match_with_any_element();
            }
            return this;
        }
        if (!other.match_with_another_element_widget) {
            return this;
        }
        return other.match_with_another_element_widget(this);
    };
    
    element.match_with_any_element = function () {
        return 'matched';
    };
    
    element.match_with_another_element_widget = function (element_pattern) {
        var text_pattern;
        if (this.get_HTML() === element_pattern.get_HTML()) {
            return 'matched';
        }
        text_pattern = element_pattern.get_text();
        if (text_pattern !== "" && text_pattern === this.get_text()) {
            return 'matched';
        }
        return element_pattern;
    };

    element.compare_with = function (other) {
        if (other.compare_with_other_element) {
            return other.compare_with_other_element(this);
        }
    };

    element.compare_with_other_element = function (other_element) {
        var comparison = other_element.get_HTML().localeCompare(this.get_HTML());
        if (comparison < 0) {
            return -1;
        }
        if (comparison > 0) {
            return 1;
        }
        return comparison;
    };

    element.widget_dropped_on_me = function (other, other_is_backside, event, robot) {
        // TODO: involve Bammer the Mouse if being watched
        if (this.get_erased() && other.get_HTML) {
            this.set_HTML(other.get_HTML());
            this.set_erased(false);
            other.remove();
            return true;
        }
        console.log("Dropping widgets on un-erased elements does nothing (but may someday)");
    };
    
    element.create_backside = function () {
        return TT.element_backside.create(this);
    };

    element.get_attribute_from_pending_css = function (attribute) {
        var pending_css = this.get_pending_css();
        var transform_css;
        if (pending_css && pending_css[attribute]) {
            return pending_css[attribute];
        }
        transform_css = this.get_transform_css();
        if (transform_css && transform_css[attribute]) {
            return transform_css[attribute];
        }
    };
    
    element.get_attribute = function (attribute) {
        var value = this.get_attribute_from_pending_css(attribute);
        if (typeof value !== 'undefined') {
            return value;
        };
        return this.get_attribute_from_current_css(attribute);
    };
    
    element.set_attribute = function (attribute, new_value, handle_training, add_to_style_attributes) {
        var frontside = this.get_frontside(true);
        var frontside_element = frontside.get_element();
        var css = {};
        var current_value, new_value_number;
        var style_attributes;
//      console.log(attribute + " of " + this.debug_id + " is " + new_value);
        if (!frontside_element) {
            return false;
        }
        current_value = this.get_attribute_from_pending_css(attribute);
        if (current_value === new_value) {
            return false;
        }
        if (typeof current_value === 'undefined') {
            current_value = this.get_attribute_from_current_css(attribute);
        }      
        // need to use a number for JQuery's css otherwise treats "100" as "auto"
        new_value_number = value_in_pixels(new_value, attribute);
        if (typeof new_value_number === 'number') {
            if (current_value == new_value_number) {
                // using == instead of === since want type coercion. current_value might be a string
                return false;
            }
            // seems we have to live with integer values for width and height
//             if ((attribute === 'width' || attribute === 'height') &&
//                 current_value == Math.round(new_value_number)) { // note double equal here
//                 // width and height as CSS style attributes become integers so don't set if equal when rounded
//                 return;
//             }
            new_value = new_value_number;
        }
        if (handle_training && TT.robot.in_training) {
            TT.robot.in_training.edited(this, {setter_name: "set_attribute",
                                               argument_1: attribute,
                                               argument_2: new_value,
                                               toString: "change the '" + attribute + "' style to " + new_value + " of",
                                               button_selector: ".toontalk-element-" + attribute + "-attribute-input"});
        }
        this.add_to_css(attribute, new_value);
        if (add_to_style_attributes) {
            style_attributes = this.get_style_attributes();
            if (style_attributes.indexOf(attribute) < 0) {
                style_attributes.push(attribute);
            }
        }
        this.rerender();
        return true;
    };
    
    element.dropped_on_style_attribute = function (dropped, attribute_name, event, robot) {
        var widget_string, widget_number, attribute_name, attribute_value, attribute_numerical_value, new_value;
        if (!dropped) {
            return;
        }
        widget_string = dropped.toString();
        if (dropped.is_number()) {
            attribute_value = this.get_attribute(attribute_name);
            if (typeof attribute_value === 'number') {
                attribute_numerical_value = attribute_value;
            } else if (attribute_value === 'auto') {
                switch (attribute_name) {
                    case "left":
                    attribute_numerical_value = $(this.get_frontside_element()).offset().left;
                    break;
                    case "top":
                    attribute_numerical_value = $(this.get_frontside_element()).offset().top;
                    break;
                    default:
                    attribute_numerical_value = 0;
                }
            } else {
                attribute_numerical_value = parseFloat(attribute_value);
                // what if NaN?
            }
            widget_number = dropped.to_float();
            switch (widget_string.substring(0, 1)) {
                case '-':
                new_value = attribute_numerical_value - widget_number;
                break;
                case '*':
                new_value = attribute_numerical_value * widget_number;
                break;
                case '/':
                new_value = attribute_numerical_value / widget_number;
                break;
                case '^':
                new_value = Math.pow(attribute_numerical_value, widget_number);
                break;
                default:
                new_value = attribute_numerical_value + widget_number;
            }
            // following doesn't handle training since is handled below
            this.set_attribute(attribute_name, new_value, false);
            if (event || (robot && robot.visible())) {
                this.get_backside().render();
            }
        }
        if (!dropped.get_infinite_stack()) {
            dropped.remove();
        }
        if (TT.robot.in_training && event) {
            TT.robot.in_training.dropped_on(dropped, this.create_attribute_widget(attribute_name));
        }
    };

    element.get_attribute_widget_in_backside_table = function (attribute_name, dont_create) {
        var attribute_widget = this.get_attribute_widgets_in_backside_table()[attribute_name];
        if (!attribute_widget && !dont_create) {
            attribute_widget = this.create_attribute_widget(attribute_name);
            this.get_attribute_widgets_in_backside_table()[attribute_name] = attribute_widget;
        }
        return attribute_widget;
    };

    element.create_attribute_widget = function (attribute_name) {
        var selector = ".toontalk-element-" + attribute_name + "-attribute-input";
        var backside_element = this.get_backside_element();
        var attribute_value = this.get_attribute(attribute_name);
        var this_element_widget = this;
        var drag_listener = 
            function (event) {
                // ensures numbers are updated as the element is dragged
                var owner = attribute_widget.get_attribute_owner();
                var top_level_position, attribute_value;
                if (event.currentTarget.toontalk_widget !== owner) {
                    return;
                }
                top_level_position = $(owner.get_frontside_element()).closest(".toontalk-top-level-backside").offset();
                if (!top_level_position) {
                    console.log("Unable to find top-level backside of an element for its position. Perhaps is 'visible' but not attached.");
                    top_level_position = {left: 0, top: 0};
                }
                attribute_value = attribute_name === 'left' ? 
                                  event.pageX-top_level_position.left-owner.drag_x_offset :
                                  event.pageY-top_level_position.top -owner.drag_y_offset;
                attribute_widget.set_value_from_decimal(attribute_value);
                number_update_display.call(attribute_widget);
        }.bind(this);
        var create_numeric_attribute_widget = function (attribute_name, attribute_value) {
            var attribute_widget = TT.number.create(0, 1);
            attribute_widget.element_widget = this;
            attribute_widget.set_value_from_decimal(attribute_value);
            attribute_widget.set_format('decimal');
            attribute_widget.attribute = attribute_name; // TODO: rename? use accessors?
            attribute_widget.get_type_name = function (plural) {
                if (plural) {
                    return "element attributes";
                }
                return "element attribute";
            };
            number_to_string = attribute_widget.toString;
            attribute_widget.toString = function () {
                return number_to_string.call(this) + " (" + this.attribute + ")";
            };
            number_get_custom_title_prefix = attribute_widget.get_custom_title_prefix;
            attribute_widget.get_custom_title_prefix = function () {
                return "This is the '" + this.attribute + "' attribute of " + attribute_widget.element_widget + "\n" +
                    number_get_custom_title_prefix.call(this);
            };
    //         attribute_widget.get_element = function () {
    //             if ($attribute_input && $attribute_input.length > 0) {
    //                 return $attribute_input.get(0);
    //             }
    //         };
            number_equals = attribute_widget.equals;
            attribute_widget.equals = function (other) {
                if (attribute_name === other.attribute) {
                    return this.equals(other.element_widget);
                }
                return number_equals.call(this, other);
            };
            return attribute_widget;
        }.bind(this);
        var $attribute_input, attribute_widget, original_copies, frontside_element,
            // store some default number functions:
            number_equals, number_update_display, number_to_string, number_get_custom_title_prefix;
        if (backside_element) {
            $attribute_input = $(backside_element).find(selector);
            if ($attribute_input.length > 0) {
                $attribute_input.get(0).toontalk_widget = this;
            }
        }
        // TODO: make this conditional on attribute_value being a number
        // and implement string valued attributes
        attribute_widget = create_numeric_attribute_widget(attribute_name, attribute_value);
        // a change to any of the copies is instantly reflected in all
        original_copies = this.get_original_copies()[attribute_name];
        if (original_copies) {
            original_copies.push(attribute_widget);
        } else {
            this.get_original_copies()[attribute_name] = [attribute_widget];
        }
        // another way to implement this would be for the recursive call to add an extra parameter: ignore_copies
        attribute_widget.set_value = function (new_value) {
            // need to convert new_value into a decimal approximation
            // since bigrat.toDecimal works by converting the numerator and denominator to JavaScript numbers
            // so best to approximate -- also should be faster to do arithmetic
            var copies = this_element_widget.get_original_copies()[attribute_name];
            var decimal_value = bigrat.toDecimal(new_value);
            var return_value, value_approximation;
            if (this.get_attribute_owner().set_attribute(this.attribute, decimal_value)) {
                // if the new_value is different from the current value
                value_approximation = bigrat.fromDecimal(decimal_value);
                copies.forEach(function (copy, index) {
                    return_value = copy.set_value_from_sub_classes(value_approximation, true); 
              });
            }
            return return_value;
        };
//         attribute_widget.visible = function () {
//             // TODO: determine if this should work this way or use widget.visible?
//             return $attribute_input && $attribute_input.is(":visible");
//         };
        number_update_display = attribute_widget.update_display;
        attribute_widget.update_display = function () {
            var attribute_value;
            if (!this.get_erased()) {
                attribute_value = this.get_attribute_owner().get_attribute(this.attribute);
                attribute_widget.set_value_from_decimal(attribute_value);
            }
            number_update_display.call(this);
        };
        if (attributes_needing_updating.indexOf(attribute_name) >= 0) {
            this.on_update_display(function () {
                attribute_widget.rerender();
                return true; // don't remove
            });
            if (attribute_name === 'left' || attribute_name === 'top') {
                frontside_element = this.get_frontside_element();
                frontside_element.addEventListener('drag', drag_listener);
            }
        }
        attribute_widget.copy = function (parameters) {
            if (parameters && parameters.just_value) {
                // just copy as a number
                return TT.number.copy.call(this, parameters);
            }
            return this.add_to_copy(this_element_widget.create_attribute_widget(attribute_name), parameters);
        };
        attribute_widget.get_json = function (json_history) {
            return {type: 'attribute_number',
                    attribute_name: attribute_name,
                    element: TT.UTILITIES.get_json(this_element_widget, json_history)};            
        };
        attribute_widget.get_original_attribute_widget = function () {
            return this_element_widget.get_original_copies()[attribute_name][0];
        };
        attribute_widget.get_attribute_owner = function () {
            // return this_element_widget or backside top ancestor of type element
            var get_backside_parent = function (widget) {
                // follows front side parent until a backside parent is found
                var parent = widget.get_parent_of_frontside();
                if (parent) {
                    if (parent.is_backside()) {
                        return parent;
                    }
                    return get_backside_parent(parent.get_widget());
                }
                // if backside never opened then the attribute_widget may not have a parent
                // which is OK since will treat this_element_widget as its owner
            };
            // if this is a copy use the original 
            var original = this.get_original_attribute_widget();
            if (original !== this) {
                return original.get_attribute_owner();
            }
            var backside_ancestor_side, widget, widget_parent;
            backside_ancestor_side = get_backside_parent(this);
            if (!backside_ancestor_side) {
                return this_element_widget;
            }
            if (!backside_ancestor_side.get_widget().is_element()) {
                return this_element_widget;
            }
            widget = backside_ancestor_side.get_widget();
            widget_parent = widget.get_parent_of_backside();
            while ((widget_parent &&
                    widget_parent.get_widget().is_element())) {
                widget = widget_parent.get_widget();
                widget_parent = widget.get_parent_of_backside();
            }
            return widget;
        };
        return attribute_widget;
    };

    TT.creators_from_json["attribute_number"] = function (json, additional_info) {
        var element_widget = TT.UTILITIES.create_from_json(json.element, additional_info);
        return element_widget.create_attribute_widget(json.attribute_name);
    };

    element.on_backside_hidden = function () {
        this.get_style_attributes().forEach(function (attribute) {
            var attribute_widget = this.get_attribute_widget_in_backside_table(attribute, true);
            if (attribute_widget) {
                attribute_widget.set_visible(false);
            }
        }.bind(this));
    };
   
    element.toString = function (to_string_info) {
       var scale_or_quote_html = function (html) {
           var style, first_space;
           if (html.length > 1 && html.charAt(0) === '<') {
                style = "style='width: 50px; height: 30px;'";
                first_space = html.indexOf(' ');
                return html.substring(0, first_space+1) + style + html.substring(first_space);
           }
           // else is a plain string so quote it
           return '"' + html + '"';
        };
        var description = to_string_info && to_string_info.role === "conditions" ?
                      this.get_text() :
                      "the element " + scale_or_quote_html(this.get_HTML());        
//         if (TT.debugging && (!(to_string_info && to_string_info.role === "conditions"))) {
//             description += " (" + this.debug_id + ")";
//         }
        return description;
    };
    
    element.get_type_name = function (plural) {
        if (plural) {
            return "elements";
        }
        return "element";
    };

    element.get_help_URL = function () {
        return "docs/manual/elements.html";
    };
    
    element.get_json = function (json_history) {
        var attributes = this.get_style_attributes();
        var json_attributes = [];
        var html = TT.UTILITIES.remove_z_index(this.get_HTML()); // z-index is transient
        var html_encoded = encodeURIComponent(html);
        // rewrite using startsWith in ECMAScript version 6
        var html_worth_sharing = html.indexOf("<img src='data:image/") === 0;
        var html_encoded_or_shared, html_index;
        if (html_worth_sharing) {
            if (!json_history.shared_html) {
                json_history.shared_html = [];
            }
            html_index = json_history.shared_html.indexOf(html_encoded);
            if (html_index < 0) {
                html_index = json_history.shared_html.push(html_encoded)-1;
            }
            html_encoded_or_shared = {shared_html_index: html_index};
        } else {
            html_encoded_or_shared = html_encoded;
        }
        attributes.forEach(function (item) {
            // don't want them to appear where they were in the source page
            // need to revisit this since sometimes we want left and top
            // maybe when loading don't obey their values
//             if (item !== "left" && item !== "top") {
                json_attributes.push(item);
//             }
        });
        return {type: "element",
                // z-index info is temporary and should not be captured here
                html: html_encoded_or_shared, 
                attributes: json_attributes,
                attribute_values: json_attributes.map(this.get_attribute.bind(this)),
                additional_classes: this.get_additional_classes()
                };
    };
    
    TT.creators_from_json["element"] = function (json, additional_info) {
        var html = decodeURIComponent(typeof json.html === 'string' ? json.html : additional_info.shared_html[json.html.shared_html_index]); 
        var reconstructed_element = element.create(html, json.attributes, json.description);
        var ignore_attributes;
        if (additional_info && additional_info.event) {
            // perhaps should check that event is a drop event
            // drop event location has priority over these settings
            ignore_attributes = ["left", "top"];
        } else {
            ignore_attributes = [];
        }
        json.attribute_values.forEach(function (value, index) {
            var attribute_name = json.attributes[index];
            if (ignore_attributes.indexOf(attribute_name) < 0) {
                reconstructed_element.add_to_css(attribute_name, value_in_pixels(value) || value);
            }
        });
        if (json.additional_classes) {
            reconstructed_element.set_additional_classes(json.additional_classes);
        }
        return reconstructed_element;
    };
    
    element.create_attribute_path = function (attribute_widget, robot) {
        var path_to_element_widget = TT.path.get_path_to(attribute_widget.element_widget, robot);
        return this.extend_attribute_path(path_to_element_widget, attribute_widget.attribute);
    };
    
    element.extend_attribute_path = function (path_to_element_widget, attribute_name) {
       return {
            dereference: function (context, top_level_context, robot) {
                // if the robot is running on the backside of a widget that is on the backside of the top_level_context
                // then use the top_level_context
                var element_widget = path_to_element_widget.dereference((top_level_context || context), undefined, robot);
                return element_widget.get_attribute_widget_in_backside_table(attribute_name);
            },
            toString: function () {
                return "the '" + attribute_name + "' property of " + path_to_element_widget;
            },
            get_json: function () {
                return {type: "path_to_style_attribute",
                        attribute: attribute_name,
                        element_widget_path: path_to_element_widget.get_json()};
            }};
    };
    
    TT.creators_from_json["path_to_style_attribute"] = function (json) {
        var element_widget_path = TT.UTILITIES.create_from_json(json.element_widget_path);
        return element.extend_attribute_path(element_widget_path, json.attribute);
    };

    element.get_size_attributes = function () {
        return {clientWidth:  this.get_attribute('width'),
                clientHeight: this.get_attribute('height')};
    };

    element.set_size_attributes = function (width, height, update_regardless) {
        if (update_regardless) {
            this.add_to_css('width',  width);
            this.add_to_css('height', height);
        } else {
            this.set_attribute('width',  width);
            this.set_attribute('height', height);
        }
        TT.UTILITIES.set_timeout(function () {
            this.rerender();
        }.bind(this));        
    };

    element.set_location_attributes = function (left, top) {
        this.set_attribute('left', left);
        this.set_attribute('top',  top);
    };
    
    return element;
}(window.TOONTALK));

window.TOONTALK.element_backside = 
(function (TT) {
    "use strict";
    
    var update_style_attribute_chooser = function (attributes_chooser, element_widget, attribute_table) {
        // the following could be made the default
        // but if TT.attribute_options is set use it instead
        var options = [{label: "Geometry attributes",
                        sub_menus: ["left", "top", "width", "height", "z-index", "background-position"]},
                       {label: "Color attributes",
                        sub_menus: ["background-color", "color", "opacity"]},
                       {label: "Font attributes",
                        sub_menus: ["font-size", "font-weight"]},
                       {label: "Visibility",
                        sub_menus: ["display", "visibility"]},
                       {label: "Transformations",
                        sub_menus: ["rotate", "skewX", "skewY", "transform-origin-x", "transform-origin-y"]}];
        var add_style_attribute = function (attribute) {
            var style_attributes = element_widget.get_style_attributes();
            var frontside_element;
            if (style_attributes.indexOf(attribute) < 0) {
               style_attributes.push(attribute);
               // update the backside during drag if 'left' or 'top' are attributes
               if (attribute === 'left') {
                   frontside_element = element_widget.get_frontside_element();
                   $(frontside_element).on('drag', function (event) {
                       var backside_element  = element_widget.get_backside_element();
                       var frontside_element = element_widget.get_frontside_element();
                       if (backside_element && frontside_element) {
                           $(backside_element).find(".toontalk-element-left-attribute-input").val(event.originalEvent.clientX);
                       }

                   });
               } else if (attribute === 'top') {
                   frontside_element = element_widget.get_frontside_element();
                   $(frontside_element).on('drag', function (event) {
                       var backside_element  = element_widget.get_backside_element();
                       var frontside_element = element_widget.get_frontside_element();
                       if (backside_element && frontside_element) {
                           $(backside_element).find(".toontalk-element-top-attribute-input").val(event.originalEvent.clientY);
                       }
                   });
               }
            }
        };
        var remove_style_attribute = function (attribute) {
            var style_attributes = element_widget.get_style_attributes();
            var index = style_attributes.indexOf(attribute);
            if (index >= 0) {
               style_attributes.splice(index, 1);
               update_style_attribute_chooser(attributes_chooser, element_widget, attribute_table);
            }
        };
        var documentation_source = function (attribute) {
            if (attribute === 'transform-origin-x' || attribute === 'transform-origin-y') {
                // # added so rest is ignored
                return "https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin#"
            } else if (is_transformation_option(attribute)) {
                return "https://developer.mozilla.org/en-US/docs/Web/CSS/transform#";
            } else {
                return "http://www.w3.org/community/webed/wiki/CSS/Properties/";
            }
        }; 
        var process_menu_item = function (option, menu_list) {
            var style_attributes = element_widget.get_style_attributes();
            var already_added = style_attributes.indexOf(option) >= 0;
            var title = "Click to add or remove the '" + option + "' style attribute from the backside of this element.";
            var check_box = TT.UTILITIES.create_check_box(already_added, "toontalk-style-attribute-check-box", option+"&nbsp;", title);
            var documentation_link = TT.UTILITIES.create_anchor_element("i", documentation_source(option) + option);
            var list_item = document.createElement("li");
            $(documentation_link).addClass("toontalk-help-button notranslate toontalk-attribute-help-button");
            $(documentation_link).css({color: "white"}); // ui-widget-content interferes with this
            documentation_link.translate = false; // should not be translated
            documentation_link.lang      = "en";
            check_box.container.appendChild(documentation_link);
            check_box.button.addEventListener('click', function (event) {
                if (check_box.button.checked) {
                    add_style_attribute(option);
                } else {
                    remove_style_attribute(option);
                }
                update_style_attributes_table(attribute_table, element_widget, element_widget.get_backside());
            });
            list_item.appendChild(check_box.container);
            menu_list.appendChild(list_item);
         };
        var process_options = function (sub_tree, menu_list) {
            var category_header, sub_menu_list;
            if (typeof sub_tree === 'string') {
                process_menu_item(sub_tree, menu_list);
            } else if (sub_tree.label) {
                category_header = document.createElement("h3");
                category_header.textContent = sub_tree.label;
                sub_menu_list = document.createElement("ul");
                menu_list.appendChild(category_header);
                menu_list.appendChild(sub_menu_list);   
                process_options(sub_tree.sub_menus, sub_menu_list);
            } else {
                // is an array
                sub_tree.forEach(function (sub_sub_tree) {
                    process_options(sub_sub_tree, menu_list);
                });               
            }
        };
        if ($(attributes_chooser).is(".ui-accordion")) {
            $(attributes_chooser).accordion('destroy');
        }
        $(attributes_chooser).empty();
        process_options(options, attributes_chooser);
        $(attributes_chooser).accordion({active: 0,
                                         heightStyle: "content"});
        return attributes_chooser;
    };
    
    var update_style_attributes_table = function (table, element_widget, backside) {
        if (!backside.visible()) {
            return;
        }
        var style_attributes = element_widget.get_style_attributes();
        var frontside_element = element_widget.get_frontside_element();
        $(table).empty();
        style_attributes.forEach(function (attribute) {
            var value = element_widget.get_attribute(attribute);
            var update_value = function (event) {
                element_widget.set_attribute(attribute, this.value.trim(), true);
            };
            var classes = "toontalk-element-attribute-input toontalk-element-" + attribute + "-attribute-input";
            var row = document.createElement("tr");
            var td  = document.createElement("td");
            var attribute_widget = element_widget.get_attribute_widget_in_backside_table(attribute);
            var attribute_frontside_element = attribute_widget.get_frontside_element();
            attribute_widget.set_parent_of_frontside(backside, false, true); // a white lie
            attribute_widget.set_infinite_stack(true);
            table.appendChild(row);
            row.appendChild(td);
            td.appendChild(TT.UTILITIES.create_text_element(attribute));
            td = document.createElement("td");
            row.appendChild(td);
            attribute_widget.set_visible(true);
            $(attribute_frontside_element).addClass("toontalk-element-attribute");
            td.appendChild(attribute_frontside_element);
            attribute_widget.render();           
            // TODO: add title like the following
//             attribute_value_editor = TT.UTILITIES.create_text_input(value,
//                                                                     classes,
//                                                                     undefined,
//                                                                     "Click here to edit the '" + attribute + "' style attribute of this element.");
//             attribute_value_editor.button.name = attribute;
//             attribute_value_editor.button.addEventListener('input', update_value);
//             TT.UTILITIES.can_receive_drops(attribute_value_editor.container);
//             td.appendChild(attribute_value_editor.container);
        });
//         return table;
    };
    
    var create_show_attributes_chooser = function (attributes_chooser) {
        var show_label = "Add or remove style attributes";
        var show_title = "Click to add widgets for reading and writing style attributes of this element.";
        var hide_label = "Hide style attributes list";
        var hide_title = "Click to hide the list of attributes that can be added or removed.";
        var $show_chooser_button = $("<button>" + show_label + "</button>").button();
        $show_chooser_button.addClass("toontalk-show-attributes-chooser-button");
        $show_chooser_button.click(function (event) {
            if ($(attributes_chooser).is(":visible")) {
                $(attributes_chooser).hide();
                $show_chooser_button.button("option", "label", show_label);
                $show_chooser_button.attr("title", show_title);
            } else {
                $(attributes_chooser).show();
                $show_chooser_button.button("option", "label", hide_label);
                $show_chooser_button.attr("title", hide_title);
            }
        });
        $show_chooser_button.attr("title", show_title);
        return $show_chooser_button.get(0);
    };
    
    return {
        create: function (element_widget) {
            // TODO: determine if this should implement walk_children to the attributes in the table
            var backside = TT.backside.create(element_widget);
            var backside_element = backside.get_element();
            var html = element_widget.get_HTML();
            var attribute_table = document.createElement("table");
            var attributes_chooser = document.createElement("div");
            var show_attributes_chooser = create_show_attributes_chooser(attributes_chooser);
            var advanced_settings_button = TT.backside.create_advanced_settings_button(backside, element_widget);
            // conditional on URL parameter whether HTML or plain text
            // default is plain text (displayed and edited) (if there is any -- could be an image or something else)
            // full HTML editing but that is both insecure (should cleanse the HTML) and confusing to non-experts
            var edit_HTML = TT.UTILITIES.get_current_url_boolean_parameter("elementHTML", false);
            var getter = edit_HTML ? "get_HTML" : "get_text";
            var generic_backside_update = backside.update_display;
            var text, html_input, update_html;
            // need to ensure that it 'knows' its textContent, etc.
            element_widget.initialise_element();
            text = element_widget[getter]().trim();
            if (text.length > 0 && !element_widget.get_image_element()) {
                html_input = TT.UTILITIES.create_text_area(text, "toontalk-html-input", "", "Type here to edit the text.");
                update_html = function (event) {
                    var new_text = html_input.button.value.trim();
                    var frontside_element = element_widget.get_frontside_element();
                    var setter = edit_HTML ? "set_HTML" : "set_text";
                    if (element_widget[setter](new_text) && TT.robot.in_training) {
                        TT.robot.in_training.edited(element_widget, {setter_name: setter,
                                                                     argument_1: new_text,
                                                                     toString: "change the text to " + new_text + " of",
                                                                     button_selector: ".toontalk-html-input"});
                    }
                };
                $(html_input.container).resizable();
                $(html_input.container).css({width: "100%"});
                $(html_input.button).css({width: "100%"});
                html_input.button.addEventListener('change',   update_html);
                html_input.button.addEventListener('mouseout', update_html);
                backside_element.appendChild(html_input.container);
            }
            backside.get_attributes_chooser = function () {
                return attributes_chooser;
            };
            update_style_attribute_chooser(attributes_chooser, element_widget, attribute_table);
            update_style_attributes_table(attribute_table, element_widget, backside);
            backside_element.appendChild(attributes_chooser);
            backside_element.appendChild(show_attributes_chooser);
            backside_element.appendChild(attribute_table);
            backside_element.appendChild(advanced_settings_button);
            $(attributes_chooser).hide();
            $(attributes_chooser).addClass("toontalk-attributes-chooser");
            backside.update_display = function () {
                if (html_input) {
                    $(html_input.button).val(element_widget[getter]());
                }
                update_style_attributes_table(attribute_table, element_widget, backside);
                if ($(attributes_chooser).is(":visible")) {
                    update_style_attribute_chooser(attributes_chooser, element_widget, attribute_table);
                }
                generic_backside_update();
            };
            // if the backside is hidden then so should the attributes chooser
            $(backside_element).find(".toontalk-hide-backside-button").click(function (event) {
                $(attributes_chooser).hide();
            });
            backside.add_advanced_settings();
            return backside;
    }};
}(window.TOONTALK));

}());