 /**
 * Implements ToonTalk's boxes
 * Authors: Ken Kahn
 * License: New BSD
 */

/*jslint browser: true, devel: true, plusplus: true, vars: true, white: true */


(function (TT) {
    "use strict";
    // functions shared by boxes and their holes

    var update_css_of_hole_contents = function (widget_side, content_element, new_width, new_height) {
        var default_width, default_height, correct_width, correct_height, css;
        if (widget_side && new_width >= 0 && widget_side.maintain_proportional_dimensions() && widget_side.get_default_width) {
            // only set the "smaller" of the two dimensions
            default_width  = widget_side.get_default_width();
            default_height = widget_side.get_default_height();
            if (new_width/default_width >= new_height/default_height) {
                // hole is wider than necessary
                // center it in the hole
                correct_width = (default_width*new_height)/default_height;
                css = {left:   (new_width-correct_width)/2,
                       top:    0,
                       width:  correct_width,
                       height: new_height};
            } else {
                correct_height = (default_height*new_width)/default_width;
                css = {left:   0,
                       top:    (new_height-correct_height)/2,
                       width:  new_width,
                       height: correct_height};
            }
        } else {
            if (widget_side.is_backside()) {
                widget_side.update_display(); // TODO: see if render is OK
                // .92 works around a display problem -- unclear what is causing it
                widget_side.scale_to(new_width, new_height*.92);
            }
            css = {left: 0,
                   top:  0};
        }
        TT.UTILITIES.set_css(content_element, css);
    };

window.TOONTALK.box = (function (TT) {

    var box = Object.create(TT.widget);

    box.create = function (size, horizontal, initial_contents, description, labels) {
        var new_box = Object.create(box);
        var holes = [];
        var i;
        if (typeof horizontal === 'undefined') {
            // default is horizontal
            horizontal = true;
        }
        new_box.is_box = function () {
            return true;
        };
        new_box.get_horizontal = function () {
            return horizontal;
        };
        new_box.set_horizontal = function (new_value, update_display, train) {
            horizontal = new_value;
            if (update_display) {
                $(this.get_frontside_element()).children(".toontalk-side").remove();
                this.rerender();
            }
            if (train && this.robot_in_training()) {
                this.robot_in_training().edited(this,
                                                {setter_name: "set_horizontal",
                                                 argument_1: new_value,
                                                 toString: "by changing the orientation to " + (new_value ? "horizontal" : "vertical"),
                                                 // just use the first className to find this button later
                                                 button_selector: new_value ? ".toontalk-horiztonal-radio-button" : "toontalk-vertical-radio-button"});
            }
            return this;
        };
        new_box.get_hole = function (index) {
            return holes[index];
        };
        new_box.get_hole_contents = function (index) {
            return holes[index] && holes[index].get_contents();
        };
        new_box.set_hole = function (index, new_content, update_display) {
            var frontside_element, $hole_element, content_element, hole_dimensions;
            holes[index].set_contents(new_content);
            if (update_display) {
                if (new_content) {
                    new_content.save_dimensions();
                }
                frontside_element = this.get_frontside_element();
                $hole_element = $(frontside_element).children(".toontalk-hole-number-" + index);
                $hole_element.empty();
                if (!new_content) {
                    return;
                }
                hole_dimensions = this.get_hole_dimensions();
                content_element = new_content.get_element(true);
                if ($hole_element.length > 0) {
                    $hole_element.get(0).appendChild(content_element);
                }
                update_css_of_hole_contents(new_content, content_element, hole_dimensions.width, hole_dimensions.height);
                // subtract 20 since that is the top border of toontalk-iframe-container
                $(content_element).find("iframe").attr('width',  hole_dimensions.width)
                                                 .attr('height', hole_dimensions.height-20);
                new_content.rerender();
            }
            this.rerender();
            if (TT.debugging) {
                this._debug_string = this.to_debug_string();
            }
        };
        new_box.get_holes = function () {
            return holes;
        };
        new_box.temporarily_remove_contents = function (widget, update_display) {
            // e.g. when a bird flies off to deliver something and will return
            var index = this.get_index_of(widget);
            if (!this.temporarily_removed_contents) {
                this.temporarily_removed_contents = [];
            }
            this.temporarily_removed_contents[index] = widget;
            this.set_hole(index, undefined, update_display);
            // returns a function to restore the contents
            return function () {
                this.set_hole(index, widget, update_display);
                this.temporarily_removed_contents[index] = undefined;
            }.bind(this);
        };
        new_box.get_contents_temporarily_removed = function (index) {
            if (this.temporarily_removed_contents) {
                return this.temporarily_removed_contents[index];
            }
        };
        new_box.set_contents = function (new_contents) {
            TT.UTILITIES.for_each_batch(new_contents,
                                        function (value, index) {
                                            holes[index].set_contents(value);
                                        });
        };
        new_box.get_size = function () {
            return size;
        };
        new_box.set_size = function (new_size, update_display, train) {
            var i, box_visibility, listeners, parent;
            if (size === new_size || new_size < 0 || isNaN(new_size) || new_size > Number.MAX_SAFE_INTEGER) {
                // ingore no change, negative or NaN values
                return false;
            }
            box_visibility = this.visible();
            holes.length = new_size;
            if (new_size > size) {
                for (i = size; i < new_size; i++) {
                    holes[i] = TT.box_hole.create(i);
                    holes[i].set_parent_of_frontside(new_box);
                    holes[i].set_visible(box_visibility);
                }
            }
            size = new_size;
            if (update_display) {
                if (this.constrained_by_container()) {
                    // dimensions depend upon parent so rerender it too
                    // box is grandparent
                    parent = this.get_parent_of_frontside();
                    if (parent.is_hole()) {
                        parent = parent.get_parent_of_frontside();
                    }
                    parent.rerender();
                } else {
                    this.rerender();
                }
            }
            listeners = this.get_listeners('contents_or_properties_changed');
            if (listeners) {
                listeners.forEach(function (listener) {
                    listener({type: 'contents_or_properties_changed',
                              new_size: new_size});
                });
            }
            // should the following run even if nothing changed
            if (train && this.robot_in_training()) {
                this.robot_in_training().edited(this,
                                                {setter_name: "set_size",
                                                 argument_1: new_size,
                                                 oString: "by changing the number of holes to " + new_size + " of the box",
                                                 button_selector: ".toontalk-box-size-input"});
            }
            if (TT.debugging) {
                this._debug_string = this.to_debug_string();
            }
            return true;
        };
        new_box.get_hole_dimensions = function () {
            // if parent is a hole does this need to adjust for its borders?
            var frontside_element = this.get_frontside_element();
            var box_width  = $(frontside_element).width()  || TT.box.get_default_width();
            var box_height = $(frontside_element).height() || TT.box.get_default_height();
            if (horizontal) {
                return {width: box_width/size,
                        height: box_height};
            } else {
                return {width: box_width,
                        height: box_height/size};
            }
        };
        new_box.receive_size_from_dropped = function (dropped, event) {
            // dropped drop on the size text area
            // return a string for the new size
            var size_as_number_widget, new_size;
            if (dropped.is_number()) {
                size_as_number_widget = TT.number.create(this.get_size());
                size_as_number_widget.number_dropped_on_me_semantics(dropped);
                new_size = (Math.max(0, Math.round(size_as_number_widget.to_float())));
                // if the following were used a condition for returning then robots would ignore non-size changes - e.g. adding zero
                this.set_size(new_size);
                return new_size.toString();
            }
        };
        new_box.copy = function (parameters) {
            var holes_copied, copy;
            if (!parameters) {
                // as a container it may contain birds and nests that need the parameters object
                // to maintain the correct relationships between birds and nests in the copy
                parameters = {};
            }
            holes_copied = holes.map(function (hole) {
                var content = hole.get_contents();
                if (content)
                    return content.copy(parameters);
                }
            );
            copy = box.create(size, horizontal, holes_copied, this.get_description(), this.get_name());
            return this.add_to_copy(copy, parameters);
        };
        new_box.generate_name = function () {
            // are the names (or labels) of each hole
            // each is separated by a ;
            var name = "";
            var size = this.get_size();
            while (size > 0) {
                name += ";";
                size--;
            }
            return name;
        }
        new_box.add_standard_widget_functionality(new_box);
        new_box.has_name(new_box);
        new_box.set_name(labels);
        for (i = 0; i < size; i++) {
            holes[i] = TT.box_hole.create(i);
            holes[i].set_parent_of_frontside(new_box);
        }
        new_box.set_description(description);
        if (TT.listen) {
            var formats = 'left to right | horizontal | top to bottom | vertical';
            var number_spoken, plain_text_message, previous_message;
            new_box.add_speech_listeners({commands: formats,
                                          numbers_acceptable: true,
                                          descriptions_acceptable: true,
                                          success_callback: function (command) {
                                                 // if draging a copy (from an infinite stack) then update the copy not the stack
                                                 var target_box = TT.UTILITIES.get_dragee_copy() || new_box;
                                                 var size;
                                                 switch (command) {
                                                     case 'left to right':
                                                     case'horizontal':
                                                     target_box.set_horizontal(true, true, true);
                                                     break;
                                                     case 'top to bottom':
                                                     case 'vertical':
                                                     target_box.set_horizontal(false, true, true);
                                                     break;
                                                     default:
                                                     number_spoken = parseInt(command); // only integers make sense
                                                     if (isNaN(number_spoken)) {
                                                         console.log("did not understand '" + command + "'");
                                                     } else {
                                                         // what about negative numbers?
                                                         target_box.set_size(number_spoken, true, true);
                                                     }
                                                  }
                                                  target_box.update_display(true);
                                                  size = target_box.get_size();
                                                  plain_text_message = "You are now holding a " +
                                                                        (target_box.get_horizontal() ? "horizontal" : "vertical") + " box with " +
                                                                        ((size > 1) ? (size + " holes") : ((size === 0) ? "no holes" : "one hole")) + ".";
                                                  if (plain_text_message !== previous_message) {
                                                      new_box.display_message(plain_text_message,
                                                                              {display_on_backside_if_possible: true,
                                                                               duration: 4000});
                                                      previous_message = plain_text_message;
                                                  }
                                          }});
        }
        if (initial_contents) {
            new_box.set_contents(initial_contents);
        }
        if (TT.debugging) {
            new_box._debug_id = TT.UTILITIES.generate_unique_id();
            new_box._debug_string = new_box.to_debug_string();
        }
        return new_box;
    };

    box.create_backside = function () {
        return TT.box_backside.create(this); // .update_run_button_disabled_attribute();
    };

    box.equals = function (other) {
        // could be scale and box so need the type name test
        return other.equals_box && this.get_type_name() === other.get_type_name() && other.equals_box(this);
    };

    box.equals_box = function (other_box) {
        // what should this do if either or both are erased?
        var size = this.get_size();
        var i, my_hole, pattern_hole;
        if (size !== other_box.get_size()) {
            return false;
        }
        for (i = 0; i < size; i++) {
            my_hole = this.get_hole_contents(i);
            pattern_hole = other_box.get_hole_contents(i);
            if ((!my_hole && pattern_hole) || (my_hole && !pattern_hole)) {
                return false;
            }
            if (my_hole && pattern_hole && !(my_hole.equals && my_hole.equals(pattern_hole))) {
                return false;
            }
        }
        return true;
    };

    box.compare_with = function (other) {
        if (other.compare_with_box) {
            return -1*other.compare_with_box(this);
        }
    };

    box.compare_with_box = function (other_box) {
        var box1_size = this.get_size();
        var box2_size = other_box.get_size();
        var i, hole1, hole2, hole_comparison;
        if (box1_size > box2_size) {
            return 1;
        }
        if (box1_size < box2_size) {
            return -1;
        }
        for (i = 0; i < box1_size; i++) {
            hole1 = this.get_hole_contents(i);
            hole2 = other_box.get_hole_contents(i);
            if (hole1 && !hole2) {
                return 1;
            }
            if (!hole1 && hole2) {
                return -1;
            }
            if (hole1 && hole2) {
                if (hole1.compare_with) {
                    hole_comparison = hole1.compare_with(hole2);
                    if (hole_comparison === 1 || hole_comparison === -1) {
                        return hole_comparison;
                    }
                } else {
                    return; // undefined
                }
            }
        }
        return 0;
    };

    box.match = function (other) {
        if (this.get_erased && this.get_erased()) {
            // get_widget() because an erased box matches the backside of an erased box
            if (other.get_widget().match_with_any_box) {
                return other.get_widget().match_with_any_box();
            }
            this.last_match = other;
            return this;
        }
        if (!other.match_with_this_box) {
            this.last_match = other;
            return this;
        }
        return other.match_with_this_box(this);
    };

    box.match_with_any_box = function () {
        return 'matched';
    };

    box.match_with_this_box = function (pattern_box) {
        var size = this.get_size();
        // typically only nests are waiting but a bird busy delivering before returning to a hole also waits
        var waiting_widgets = [];
        var i, my_hole, pattern_hole, hole_match, contents_temporarily_removed;
        if (size !== pattern_box.get_size()) {
            pattern_box.last_match = this;
            return pattern_box;
        }
        for (i = 0; i < size; i++) {
            pattern_hole = pattern_box.get_hole_contents(i);
            if (pattern_hole) {
                my_hole = this.get_hole_contents(i);
                if (my_hole) {
                    hole_match = TT.UTILITIES.match(pattern_hole, my_hole);
                    if (hole_match.is_widget) {
                        // sub-match failed
                        return hole_match;
                    }
                    if (hole_match !== 'matched') {
                        // suspended on a nest so combine the suspended nests
                        if (waiting_widgets.length === 0) {
                            waiting_widgets = hole_match;
                        } else {
                            waiting_widgets = waiting_widgets.concat(hole_match);
                        }
                    }
                } else {
                    // first check if contents temporarily missing (e.g. a bird busy delivering)
                    contents_temporarily_removed = this.get_contents_temporarily_removed(i);
                    if (contents_temporarily_removed) {
                        waiting_widgets.push(contents_temporarily_removed);
                    } else {
                        // expected something -- not an empty hole
                        pattern_box.last_match = this;
                        return pattern_box; // or should this be pattern_hole to provide more tragetted feedback?
                    }
                }
            }
        }
        if (waiting_widgets.length > 0) {
            return waiting_widgets;
        }
        return 'matched';
    };

    box.toString = function (to_string_info) {
        var contents = "";
        var size = this.get_size();
        var i, hole;
        var extra_text = this.get_type_name() + " that looks like ";
        for (i = 0; i < size; i++) {
            hole = this.get_hole(i);
            contents += hole.get_full_description(to_string_info);
            if (i < size - 1) {
                contents += " | ";
            }
        }
        // only want the extra_text on the topmost level
        return extra_text + "[" + contents.replace(extra_text, "") + ']';
    };

    box.get_type_name = function  (plural) {
        if (plural) {
            return "boxes";
        }
        return "box";
    };

    box.get_default_description = function () {
        return "a box for holding things.";
    };

    box.get_help_URL = function () {
        return "docs/manual/boxes.html";
    };

    box.get_json = function (json_history, callback, start_time, depth) {
        var contents_json = [];
        var collect_contents_json = function (index, start_time, depth) {
            // this is similar to utilities.get_json_of_array but iterates and terminates differently
            var widget_side, new_callback;
            if (index >= this.get_size()) {
                callback({type: "box",
                          size: this.get_size(),
                          contents: contents_json,
                          horizontal: this.get_horizontal(),
                          name: this.get_name()
                         },
                         start_time,
                         depth+1);
                return;
            }
            widget_side = this.get_hole_contents(index);
            if (!widget_side) {
                contents_json.push(null);
                collect_contents_json(index+1, start_time, depth+1);
                return;
            }
            if (widget_side.is_primary_backside && widget_side.is_primary_backside()) {
                new_callback = function (json, new_start_time, depth) {
                    contents_json.push({widget: json,
                                        is_backside: true});
                    collect_contents_json(index+1, new_start_time, depth+1);
                }.bind(this);
                TT.UTILITIES.get_json(widget_side.get_widget(), json_history, new_callback, start_time, depth+1);
            } else
            if (widget_side.is_widget) {
                new_callback = function (json, new_start_time, depth) {
                    contents_json.push({widget: json});
                    collect_contents_json(index+1, new_start_time, depth+1);
                }.bind(this);
                TT.UTILITIES.get_json(widget_side, json_history, new_callback, start_time, depth+1);
            } else {
                // isn't a widget -- e.g. is a path
                new_callback = function (json, new_start_time, depth) {
                    contents_json.push(json);
                    collect_contents_json(index+1, new_start_time, depth+1);
                }.bind(this);
                widget_side.get_json(json_history, new_callback, start_time, depth+1);
            }
        }.bind(this);
        collect_contents_json(0, start_time, depth+1);
    };

    box.walk_children = function (child_action) {
        var size = this.get_size();
        var i, contents;
        for (i = 0; i < size; i++) {
            contents = this.get_hole_contents(i);
            if (contents) {
                if (!child_action(contents)) {
                    // aborted
                    return;
                }
            } else if (!child_action(this.get_hole(i))) {
                // aborted
                return;
            }
        }
    };

    TT.creators_from_json['box'] = function (json, additional_info) {
        if (!json) {
            // no possibility of cyclic references so don't split its creation into two phases
            return;
        }
        return box.create(json.size, json.horizontal, TT.UTILITIES.create_array_from_json(json.contents, additional_info), json.description, json.name);
    };

    box.update_display = function () {
        var frontside = this.get_frontside(true);
        var frontside_element = frontside.get_element();
        var size = this.get_size();
        var z_index = TT.UTILITIES.get_style_numeric_property(frontside_element, 'z-index');
        var update_hole = function (hole_element, hole, index) {
            var contents = hole.get_contents();
            var content_element = (contents || hole).get_element(true);
            var $parents = $(hole_element).parents(".toontalk-box-hole");
            var adjust_if_on_a_nest = function () {
                if ($(hole_element).parents(".toontalk-box-hole").children(".toontalk-nest").is("*")) {
                    // nests display their contents smaller so edges of nest is visible
                    new_width  /= TT.nest.CONTENTS_WIDTH_FACTOR;
                    new_height /= TT.nest.CONTENTS_HEIGHT_FACTOR;
                }
            };
            var left, top, new_width, new_height, hole_contents, css;
            
            if (!hole_element.parentElement) {
                // hole must be part of a box -- assume this is during initialisation so try again soon
                setTimeout(function () {
                    update_hole(hole_element, hole, index);
                });
                return;
            }
            if (horizontal) {
                top = 0;
                if ($parents.length > 0 || $(frontside_element).is(".toontalk-conditions-contents")) {
                    new_width  = hole_width -2*border_size/size;
                    new_height = hole_height-2*border_size;
                } else {
                    new_width  = hole_width;
                    new_height = hole_height;
                }
                adjust_if_on_a_nest();
                left = new_width*index;
                if (index > 1) {
                    left += border_size*(index-1);
                }
            } else {
                left = 0;
                if ($parents.length > 0 || $(frontside_element).is(".toontalk-conditions-contents")) {
                    new_width  = hole_width -2*border_size;
                    new_height = hole_height-2*border_size/size;
                } else {
                    new_width  = hole_width;
                    new_height = hole_height;
                }
                adjust_if_on_a_nest();
                top = new_height*index;
                if (index > 1) {
                    top += border_size*(index-1);
                }
            }
            setTimeout(function () {
                           TT.UTILITIES.set_css(hole_element,
                                                {left:   left,
                                                 top:    top,
                                                 width:  new_width,
                                                 height: new_height,
                                                 "z-index": typeof z_index === 'number' && z_index+size-index});
                           if (contents) {
                               contents.render();
                           }
                        });
            if (hole_labels[index]) {
                hole_element.setAttribute("toontalk_name", hole_labels[index]);
            }
            if (!TT.UTILITIES.has_animating_image(content_element)) {
                // explicit size interferes with animation
                if (index > 0) {
                    // first hole doesn't need a divider
                    $(hole_element).removeClass("toontalk-box-eighth-size-border-left toontalk-box-quarter-size-border-left toontalk-box-half-size-border-left toontalk-box-full-size-border-left");
                    $(hole_element).removeClass("toontalk-box-eighth-size-border-top toontalk-box-quarter-size-border-top toontalk-box-half-size-border-top toontalk-box-full-size-border-top");
                    if (horizontal) {
                        $(hole_element).addClass(border_class + "-left");
                    } else {
                        $(hole_element).addClass(border_class + "-top");
                    }
                }
            }
            if (hole_element !== content_element && contents && contents.get_parent() === hole) {
                // not an empty hole
                // checked if contents still in hole since this was delayed and things may have changed
                // save dimensions first?
                update_css_of_hole_contents(contents, content_element, new_width, new_height);
                // if contents is an iframe then set its attributes
                // subtract 20 since that is the top border of toontalk-iframe-container
                $(hole.element).find("iframe").attr("width",  new_width)
                                              .attr("height", new_height-20);
                try {
                    hole_element.appendChild(content_element);
                } catch (error) {
                    TT.UTILITIES.report_internal_error(error + ". Avoided a circularity involving a box hole.");
                }
                // tried to delay the following until the changes to this box in the DOM have settled down
                // but the hole's contents may have changed
                hole.get_contents().rerender();
            }
            if (hole.is_element()) {
                css = {width:  new_width,
                       height: new_height};
                hole_contents = hole.get_contents();
                if (hole_contents.is_plain_text_element()) {
                    $(hole_contents.get_frontside_element()).css({'font-size': TT.UTILITIES.font_size(hole_contents.get_text(), new_width, {height: new_height}),
                                                                  width:  '',
                                                                  height: ''});
                } else {
                    $(hole_contents.get_frontside_element()).css(css);
                }
                hole_contents = hole_contents.dereference();
                hole_contents.set_size_attributes(new_width, new_height, true);
                // hole element needs to know its dimensions (at least when an element is on a nest in a box hole)
                $(hole_element).css(css);
            }
        };
        var too_small_to_display_borders_and_children = function () {
            return box_width < 10 || box_height < 10;
        }
        var horizontal = this.get_horizontal();
        var first_time = !$(frontside_element).is(".toontalk-box");
        var dimensions_constrained_by_container = this.constrained_by_container();
        var renderer =
            function () {
                var $box_hole_elements = $(frontside_element).children(".toontalk-box-hole");
                // TODO: decide if best to rationalise away .toontalk-conditions-contents and only use parent is .toontalk-conditions-container
                if ($(frontside_element).is(".toontalk-conditions-contents")){
                    TT.UTILITIES.set_css(frontside_element,
                                         {width:  box_width -2*border_size,
                                          height: box_height-2*border_size});
                } else if (!this.directly_inside_conditions_container() &&
                           !$(frontside_element).parent().is(".toontalk-scale-half")) {
                    if (!too_small_to_display_borders_and_children() && $(frontside_element).parent(".toontalk-box-hole").is("*")) {
                        TT.UTILITIES.set_css(frontside_element,
                                             {width:  '',
                                              height: ''});
                    } else {
                        TT.UTILITIES.set_css(frontside_element,
                                             {width:  box_width,
                                              height: box_height});
                    }
                }
                if (too_small_to_display_borders_and_children()) {
                    // too small to display hole contents
                } else if ($box_hole_elements.length === size) {
                    $box_hole_elements.each(function (index, hole_element) {
                        var hole = this.get_hole(index);
                        if (hole) {
                            // might be undefined if the box's size has been decreased while rendering
                            update_hole(hole_element, hole, index);
                        }
                    }.bind(this));
                } else {
                    // has wrong number of holes so rebuild it
                    $box_hole_elements.remove();
                    this.get_holes().forEach(function (hole, index) {
                        hole_element = hole.get_element();
                        $(hole_element).addClass("toontalk-hole-number-" + index);
                        if (hole.get_contents()) {
                            hole.get_contents().rerender();
                        }
                        update_hole(hole_element, hole, index);
                        frontside_element.appendChild(hole_element);
                    });
                };
                if (!dimensions_constrained_by_container) {
                    // unconstrained boxes have a single resize handle in the south east
                    // whose location needs to be adjusted for borders
                    $(frontside_element).children(".ui-resizable-handle").css({right:  -border_size,
                                                                               bottom: -border_size});
                }
            }.bind(this);
        var update_dimensions = function () {
            var get_containing_hole = function (element) {
                if (!element.parentElement) {
                   return;
                }
                if ($(element.parentElement).is(".toontalk-box-hole")) {
                    return element.parentElement;
                }
                return get_containing_hole(element.parentElement);
            };
            var containing_hole = get_containing_hole(frontside_element);
            var element = containing_hole || frontside_element;
            // scales explicitly control the size of the contents of their pans
            var containing_element = $(frontside_element).parent().is(".toontalk-scale-half") ? frontside_element : element;
            if (dimensions_constrained_by_container) {
                box_width  = $(containing_element).width();
                box_height = $(containing_element).height();
            } else {
                box_width = (this.directly_inside_conditions_container() && TT.UTILITIES.get_toontalk_css_numeric_attribute("width", ".toontalk-conditions-container"))
                            || (!$(containing_element).is(".toontalk-carried-by-bird") && TT.UTILITIES.get_style_numeric_property(containing_element, "width"))
                            || this.saved_width
                            || TT.box.get_default_width();
            }
            if (box_height === undefined) {
                box_height = (this.directly_inside_conditions_container() && TT.UTILITIES.get_toontalk_css_numeric_attribute("height", ".toontalk-conditions-container"))
                             || (!$(containing_element).is(".toontalk-carried-by-bird") && TT.UTILITIES.get_style_numeric_property(containing_element, "height"))
                             || this.saved_height
                             || TT.box.get_default_height();
            }
            if (horizontal) {
                if (size === 0) {
                    hole_width = 0;
                } else {
                    hole_width  = box_width/size;
                }
                hole_height = box_height;
            } else {
                hole_width  = box_width;
                hole_height = box_height/size;
            }
        }.bind(this);
        var hole_labels = this.get_name().split(";");
        var i, hole, hole_element, box_left, box_width, hole_width, first_hole_width, box_height, hole_height,
            border_class, border_size, backside;
        if (TT.logging && TT.logging.indexOf('display') >= 0) {
            console.log("Updating display of " + this.to_debug_string());
        }
        $(frontside_element).addClass("toontalk-box");
        $(frontside_element).removeClass("toontalk-box-eighth-size-border toontalk-box-quarter-size-border toontalk-box-half-size-border toontalk-box-full-size-border");
        TT.UTILITIES.give_tooltip(frontside_element, this.get_title());
        if (TT.debugging) {
            this._debug_string = this.to_debug_string();
        }
        if (this.get_erased()) {
            $(frontside_element).addClass("toontalk-box-erased");
            $(frontside_element).children(".toontalk-side").remove();
            return;
        }
        $(frontside_element).removeClass("toontalk-box-erased");
        update_dimensions();
        if (too_small_to_display_borders_and_children()) {
            renderer();
            return;
        }
        border_size = this.get_border_size(hole_width, hole_height);
        if (border_size === 4) {
            border_class = "toontalk-box-eighth-size-border";
        } else if (border_size === 8) {
            border_class = "toontalk-box-quarter-size-border";
        } else if (border_size === 16) {
            border_class = "toontalk-box-half-size-border";
        } else {
            border_class = "toontalk-box-full-size-border";
        }
        if (size === 0) {
            border_class += " toontalk-zero-hole-box";
        } else {
            // recompute hole dimensions taking into account border width
            if (horizontal) {
                hole_width  = hole_width -((size-1)*border_size)/size;
            } else {
                hole_height = hole_height-((size-1)*border_size)/size;
            }
        }
        $(frontside_element).addClass(border_class);
        // delay it until browser has rendered current elements
        TT.UTILITIES.set_timeout(renderer);
    };

    box.get_default_width = function () {
        // width of 2 hole horizontal box not including borders
        return 164;
    };

    box.get_default_height = function () {
        return 68;
    };

    box.get_border_size = function (width, height) {
        var frontside_width, size;
        if (width === 0) {
            // i.e. a zero-hole box
            frontside_width =  $(this.get_frontside_element()).width();
            // border size has been doubled since it was so hard to pick up a full box
            if (frontside_width <= 16) {
                return 8;
            }
            if (frontside_width <= 32) {
                return 16;
            }
            return 32;
        }
        if (!width && !height) {
            size = this.get_size();
            width  = $(this.get_frontside_element()).width();
            height = $(this.get_frontside_element()).height();
            if (this.get_horizontal()) {
                if (size === 0) {
                    width = 0;
                } else {
                    width  = width/size;
                }
            } else {
                if (size === 0) {
                    height = 0;
                } else {
                    height = height/this.get_size();
                }
            }
        }
        if (width <= 32 || height <= 32) {
            return 4;
        } else if (width <= 64 || height <= 64) {
            return 8;
        } else if (width <= 128 || height <= 128) {
            return 16;
        } else {
            return 32;
        }
    };

    box.is_resizable = function () {
        return true;
    };

    box.get_name_input_label = function () {
        return "The labels of my holes are";
    };

    box.get_name_input_title = function () {
        return "Each hole label is followed by a ';'. Yoou may enter as many hole labels as there are holes.";
    };

    box.drop_on = function (side_of_other, options) {
        var result;
        if (!side_of_other.box_dropped_on_me) {
            if (side_of_other.widget_side_dropped_on_me) {
                return side_of_other.widget_side_dropped_on_me(this, options);
            }
            console.log("No handler for drop of " + this + " on " + side_of_other);
            return;
        }
        result = side_of_other.box_dropped_on_me && side_of_other.box_dropped_on_me(this, options);
        if (options.event) {
            side_of_other.rerender();
        }
        if (result) {
            this.remove();
        }
        return result;
    };

    box.box_dropped_on_me = function (other, event) {
        console.log("box on box not yet implemented");
        return false;
    };

    box.widget_side_dropped_on_me = function (side_of_other, options) {
        var hole_index = this.which_hole(options.event);
        var size = this.get_size();
        var hole_contents, hole, size;
        if (hole_index === undefined && options.robot) {
            if (size > 0) {
                if (size > 1) {
                    TT.UTILITIES.display_message("Robot " +  options.robot.get_name() + " wasn't trained to know which hole of " + this + " to drop " + side_of_other + " on. Random hole chosen.");
                }
                hole_index = Math.floor(Math.random()*size);
            } else {
                TT.UTILITIES.display_message("Robot " +  options.robot.get_name() + " can't drop " + side_of_other + " on " + this + " because it has no holes.");
                return;
            }
        }
        if (hole_index >= 0) {
            hole = this.get_hole(hole_index);
            hole_contents = hole.get_contents();
            if (hole_contents) {
                return side_of_other.drop_on(hole_contents, options);
            }
            return hole.widget_side_dropped_on_me(side_of_other, options);
        }
        if (size === 0) {
            TT.UTILITIES.display_message("Can't drop " + side_of_other + " on " + this + " because it has no holes.");
        } else {
            TT.UTILITIES.report_internal_error(side_of_other + " dropped on " + this + " but no event was provided.");
        }
    };

    box.get_index_of = function (part) {
        // parent should be a hole
        return part.get_parent_of_frontside() && part.get_parent_of_frontside().get_index && part.get_parent_of_frontside().get_index();
    };

    box.name_font_size = function (width, height) {
        var size_due_to_width  = 0;
        var size_due_to_height = 0;
        if (this.get_size() === 0) {
            return 0;
        }
        if (this.get_horizontal()) {
            size_due_to_height = (height || this.get_height())/6;
            size_due_to_width  = (width  || this.get_width())/(8*this.get_size()); // 8 characters is a reasonable long label
        } else {
            size_due_to_height = (height || this.get_height())/(6*this.get_size());
            size_due_to_width  = (width  || this.get_width())/8;
        }
        return Math.min(size_due_to_width, size_due_to_height);
    };

    box.removed_from_container = function (part_side, event) {
        var update_display = !!event;
        var index = this.get_index_of(part_side);
        var hole, part_frontside_element;
        if (index >= 0) {
            this.set_hole(index, undefined, update_display);
            if (update_display) {
                this.rerender();
                part_side.restore_dimensions();
            }
        }
        // otherwise might have already been removed (e.g. by unwatched robot action called by watched robot)
    };

    box.get_path_to = function (widget, robot) {
        var size = this.get_size();
        var index, part, path, sub_path, parent_box;
        if (widget.get_type_name() === 'empty hole') {
            parent_box = widget.get_parent_of_frontside();
            sub_path = TT.box.path.create(widget.get_index());
            if (parent_box === this) {
                return sub_path;
            }
            path = this.get_path_to(parent_box);
            if (!path) {
                return;
            }
            path.next = sub_path;
            return path;
        }
        for (index = 0; index < size; index++) {
            part = this.get_hole_contents(index) || this.get_contents_temporarily_removed(index);
            if (part) {
                if (widget === part || (part.top_contents_is && part.top_contents_is(widget))) {
                    return TT.box.path.create(index);
                } else if (part.get_path_to) {
                    sub_path = part.get_path_to(widget, robot);
                    if (sub_path) {
                        path = TT.box.path.create(index);
                        path.next = sub_path;
                        return path;
                    }
                }
            }
        }
    };

    box.element_to_highlight = function (event) {
        var hole_index = this.which_hole(event, true);
        var hole, hole_contents;
        if (hole_index < 0 || this.get_size() === 0) {
            // highlight the whole thing
            return this.get_frontside_element();
        }
        hole = this.get_hole(hole_index);
        hole_contents = hole.get_contents();
        if (hole_contents) {
            return hole_contents.get_frontside_element();
        }
        return hole.get_frontside_element();
    };

    box.which_hole = function (event) {
        // if horizontal computes boundary seeing if event pageX is left of the boundary
        // otherwise sees if event pageY is below boundary
        var horizontal = this.get_horizontal();
        var frontside_element = this.get_frontside_element();
        var size = this.get_size();
        var i, position, increment, boundary;
        if (size === 0) {
            return;
        }
        position = $(frontside_element).offset();
        increment = horizontal ? $(frontside_element).width()/size : $(frontside_element).height()/size;
        boundary = horizontal ? position.left : position.top;
        if (event) { // not clear how this could be called without event
            for (i = 0; i < size; i++) {
                boundary += increment;
                if ((horizontal ? (event.pageX <= boundary) :
                                  (event.pageY <= boundary)) ||
                    // or is last one
                    i+1 === size) {
                    return i;
                }
            }
        }
    };

    box.dereference_path = function (path, robot, report_error) {
        var index, hole;
        if (path) {
            if (!path.get_index && path.next) {
                // happens if box is on a nest that is the top-level context
                path = path.next;
            }
            index = path.get_index && path.get_index();
            if (!report_error && typeof index === 'undefined') {
                return;
            }
            if (!TT.debugging || typeof index === 'number') {
                hole = this.get_hole_contents(index);
                if (hole) {
                    if (hole.dereference_contents && !path.not_to_be_dereferenced) {
                        // this will dereference the top of a nest instead of the nest itself
                        return hole.dereference_contents(path.next || path, robot);
                    }
                    if (path.next) {
                        if (hole.dereference_path) {
                            return hole.dereference_path(path.next, robot);
                        } else {
                            TT.UTILITIES.report_internal_error("Expected to refer to a part of " + hole + " but it lacks a method to obtain " + TT.path.toString(path.next));
                        }
                    }
                    if (path.removing_widget) {
                        if (hole.get_type_name() === 'empty hole') {
                            // TODO: determine if this is obsolete since hole will be a false value (e.g. null)
                            TT.UTILITIES.display_message("Robot is trying to remove something from an empty hole. ", {only_if_new: true});
                            return;
                        } else if (!hole.get_infinite_stack()) {
                            robot.remove_from_container(hole, this);
                        }
                    }
                    return hole;
                } else if (path.removing_widget) {
                    TT.UTILITIES.display_message("Robot is trying to remove something from an empty hole. ", {only_if_new: true});
                    return;
                } else {
                    // referencing an empty hole
                    return this.get_hole(index);
                }
            }
            TT.UTILITIES.display_message(this + " unable to dereference the path: " + TT.path.toString(path), {only_if_new: true});
        } else {
            return this;
        }
    };

    box.path = {
        create: function (index) {
            return {
                get_index: function () {
                    return index;
                },
                toString: function () {
                    if (this.true_type === 'scale') {
                        if (index === 0) {
                            return "the left pan ";
                        } else {
                            return "the right pan ";
                        }
                    }
                    return "the " + TT.UTILITIES.ordinal(index) + " hole ";
                },
                get_json: function (json_history, callback, start_time, depth) {
                    var next_path_callback= function (next_path_json, start_time, depth) {
                        callback({type: "box_path",
                                  index: index,
                                  true_type: this.true_type,
                                  next: next_path_json},
                                 start_time,
                                 depth+1);
                    }.bind(this);
                    if (this.next) {
                        this.next.get_json(json_history, next_path_callback, start_time, depth+1);
                    } else {
                        next_path_callback(undefined, start_time, depth+1);
                    }
                }
            };
        }
    };

    box.get_custom_title_prefix = function () {
        return "Drop things in my holes to store them.";
    };

    TT.creators_from_json["box_path"] = function (json, additional_info) {
        var path = box.path.create(json.index);
        if (json.next) {
            path.next = TT.UTILITIES.create_from_json(json.next, additional_info);
        }
        if (json.true_type) {
            // true_type is needed to distinguish boxes from scale (that are like 2-hole boxes with additional behaviours)
            path.true_type = json.true_type;
        }
        return path;
    };

    return box;
}(window.TOONTALK));

window.TOONTALK.box_backside =
(function (TT) {

    return {
        create: function (box) {
            var backside = TT.backside.create(box);
            var size_area_drop_handler =
                function (event) {
                    var dropped = TT.UTILITIES.input_area_drop_handler(event, box.receive_size_from_dropped.bind(box), box);
                    if (dropped) {
                        box.rerender();
                        if (box.robot_in_training()) {
                            box.robot_in_training().dropped_on_text_area(dropped, box, {area_selector: ".toontalk-box-size-input",
                                                                                        setter: 'receive_size_from_dropped',
                                                                                        toString: "for the box's size"});
                        }
                    }
                };
            var size_input = TT.UTILITIES.create_text_input(box.get_size().toString(), 'toontalk-box-size-input', "Number of holes", "Type here to edit the number of holes.", undefined, "number", size_area_drop_handler);
            var horizontal = TT.UTILITIES.create_radio_button("box_orientation", "horizontal", "toontalk-horiztonal-radio-button", "Left to right", "Show box horizontally.", true); // might be nicer replaced by an icon
            var vertical   = TT.UTILITIES.create_radio_button("box_orientation", "vertical", "toontalk-vertical-radio-button", "Top to bottom", "Show box vertically.", true);
            var update_value = function () {
                var new_size = parseInt(size_input.button.value.trim(), 10);
                box.set_size(new_size, true, true);
            };
            var update_orientation = function () {
                var selected = TT.UTILITIES.selected_radio_button(horizontal, vertical);
                var orientation, is_horizontal; 
                if (!selected) {
                    // not clear how this can happen but appeared in logs https://sentry.io/ken-kahn/toontalk/issues/214372255/
                    return;
                }
                orientation = selected.button.value;
                is_horizontal = (orientation === "horizontal");
                box.set_horizontal(is_horizontal, true, true);
            };
            var backside_element = backside.get_element();
            var advanced_settings_button = TT.backside.create_advanced_settings_button(backside, box);
            var generic_backside_update = backside.update_display.bind(backside);
            var buttons = TT.UTILITIES.create_div(horizontal, vertical);
            size_input.button.addEventListener('change',   update_value);
            size_input.button.addEventListener('mouseout', update_value);
            horizontal.button.addEventListener('change',   update_orientation);
            vertical.button  .addEventListener('change',   update_orientation);
            backside.update_display = function () {
                size_input.button.value = box.get_size().toString();
                if (box.get_horizontal()) {
                    TT.UTILITIES.check_radio_button(horizontal);
                } else {
                    TT.UTILITIES.check_radio_button(vertical);
                }
                generic_backside_update();
            };
            TT.UTILITIES.when_attached(backside_element,
                                       function () {
                                           if (!backside.is_primary_backside()) {
                                               // primary backsides update when frontside does
                                               box.add_listener('contents_or_properties_changed',
                                                                function () {
                                                                    backside.rerender();
                                                                });
                                           }
                                       });
            backside_element.appendChild(size_input.container);
            backside_element.appendChild(buttons);
            $(buttons).controlgroup()
                      .removeClass("ui-controlgroup"); // doesn't look good
            backside_element.appendChild(advanced_settings_button);
            backside.rerender();
            return backside;
        }};
}(window.TOONTALK));

// a hole is either empty or contains a widget
window.TOONTALK.box_hole =
(function (TT) {

    return {
        create: function (index) {
            // perhaps this should share more code with widget (e.g. done below with widget.has_parent)
            var hole = Object.create(this);
            var contents, visible, hole_element;
            hole.is_hole = function () {
                return true;
            }
            hole.is_empty_hole = function () {
                return !contents;
            };
            hole.constrained_by_container = function () {
                return false;
            };
            hole.get_element = function () {
                if (!hole_element) {
                    hole_element = document.createElement("div");
                    hole_element.className = "toontalk-box-hole toontalk-frontside toontalk-side";
                    hole_element.toontalk_widget_side = hole;
                }
                return hole_element;
            };
            hole.get_frontside = function (create) {
                if (contents) {
                    return contents.get_frontside(create);
                }
                return this.get_element();
            };
            hole.get_backside_widgets = function () {
                 if (contents) {
                    return contents.get_backside_widgets();
                }
                return [];
            };
            // there is no backside of an empty hole
            hole.get_frontside_element = function (update) {
                // this once returned the element of its contents
                // but then birds didn't know where to fly from and to
                return this.get_element();
            };
            hole.get_frontside = function () {
                // doubles as its own frontside
                return this;
            };
            hole.get_width = function () {
                return $(this.get_element()).width();
            };
            hole.get_height = function () {
                return $(this.get_element()).height();
            };
            hole.widget_side_dropped_on_me = function (dropped, options) {
                var box = this.get_parent_of_frontside();
                var contents = this.get_contents();
                var hole_element, hole_visible, hole_position, parent_position, dropped_element, finished_animating, is_plain_text;
                if (contents) {
                    return contents.widget_side_dropped_on_me && contents.widget_side_dropped_on_me(dropped, options);
                }
                if (dropped.dropped_on_other) {
                    // e.g. so egg can hatch from nest drop
                    dropped.dropped_on_other(this, options);
                }
                if (options.event) {
                    if (TT.sounds) {
                        TT.sounds.fall_inside.play();
                    }
                    hole_element = this.get_element();
                    is_plain_text = dropped.is_plain_text_element();
                    dropped_element = dropped.get_element();
                    $(dropped_element).css({"z-index": TT.UTILITIES.next_z_index()});
                    parent_position = $(dropped_element.parentElement).offset();
                    if (!is_plain_text) {
                        dropped_element.style.left = (options.event.pageX-parent_position.left)+"px";
                        dropped_element.style.top  = (options.event.pageY-parent_position.top) +"px";
                        // and animate the style changes in the following code
                        $(dropped_element).addClass("toontalk-animating-element");
                    }
                    hole_visible = TT.UTILITIES.is_attached(hole_element);
                    if (hole_visible) {
                        hole_position   = $(hole_element).offset();
                        dropped_element.style.width  = hole_element.style.width;
                        dropped_element.style.height = hole_element.style.height;
                        dropped_element.style.left = (hole_position.left-parent_position.left)+"px";
                        dropped_element.style.top  = (hole_position.top -parent_position.top) +"px";
                    } else {
                        // presumably hole is too small to be seen
                        dropped_element.style.width  = 0;
                        dropped_element.style.height = 0;
                    }
                    finished_animating = function () {
                        $(dropped_element).removeClass("toontalk-animating-element");
                        this.set_contents(dropped);
                        if (hole_visible) {
                            box.render();
                            dropped.render();
                        } else {
                            dropped_element.remove();
                        }
                        if (options.event) {
                            box.backup_all();
                        }
                    }.bind(this);
                    setTimeout(finished_animating, (is_plain_text || TT.UTILITIES.has_animating_image(dropped_element)) ? 0 : 1200);
                    if (box.robot_in_training()) {
                        box.robot_in_training().dropped_on(dropped, this);
                    }
                    if (dropped.save_dimensions) { // and maybe watched robot too?
                        if (dropped.set_size_attributes) {
                            dropped.set_size_attributes($(hole_element).width(), $(hole_element).height());
                        }
                    }
                    if (!dropped.is_backside()) {
                        box.get_frontside_element().dispatchEvent(TT.UTILITIES.create_event('widget added', {element_widget: dropped_element,
                                                                                                             where: 'front',
                                                                                                             index: this.get_index()}));
                    }
                } else {
                    box.rerender();
                    this.set_contents(dropped, options);
                }
                return true;
            };
            hole.get_json = function () {
                // no need to put anything into the array
                return null;
            };
            hole.add_to_json = function (json) {
                return json;
            };
            hole.copy = function (parameters) {
                // is this obsolete???
                return TT.box_hole.create(index);
            };
            hole.match = function () {
                return "matched";
            };
            hole.get_type_name = function (plural) {
                if (contents) {
                    return contents.get_type_name(plural);
                }
                if (plural) {
                    return "empty holes";
                }
                return "empty hole";
            };
//             hole.get_name = function () {
//                 // not currently used but might be worth keeping around
//                 var hole_names = this.get_box().get_name();
//                 var index;
//                 if (!hole_names) {
//                     return;
//                 }
//                 hole_names = hole_names.split(';');
//                 index = this.get_index();
//                 if (index < hole_names.length) {
//                     return hole_names[index];
//                 }
//             };
            hole.name_font_size = function () {
                return this.get_box().name_font_size();
            };
            hole.is_of_type = function (type_name) {
                if (contents) {
                    return contents.is_of_type(type_name);
                }
                return type_name === "empty hole";
            };
            hole.get_box = function () {
                return this.get_parent_of_frontside();
            };
            hole.update_display = function () {
                var hole_element;
                if (contents) {
                    hole_element = this.get_frontside_element();
                    update_css_of_hole_contents(contents, contents.get_element(true), $(hole_element).width(), $(hole_element).height());
                }
            };
            hole.dereference = function () {
                if (contents) {
                    return contents.dereference();
                }
                return this;
            };
            hole.can_run = function (options) {
                return contents && contents.can_run(options);
            };
            hole.get_index = function () {
                return index;
            };
            hole.get_contents = function () {
                return contents;
            };
            hole.set_contents = function (new_value, options) {
                var listeners = this.get_listeners('contents_or_properties_changed');
                if (listeners) {
                    if (contents !== new_value) {
                        listeners.forEach(function (listener) {
                            listener({type: 'contents_or_properties_changed',
                                      old_value: contents,
                                      new_value: new_value});
                        });
                    }
                    if (contents) {
                        listeners.forEach(function (listener) {
                            contents.remove_listener('contents_or_properties_changed', listener, true);
                        });
                    }
                    if (new_value) {
                        listeners.forEach(function (listener) {
                            new_value.add_listener('contents_or_properties_changed', listener);
                        });
                    }
                }
                if (contents) {
                    contents.set_parent(undefined);
                }
                contents = new_value;
                if (contents) {
                    contents.set_parent(this);
                    if (TT.debugging) {
                        this._debug_string = "A hole containing " + contents.to_debug_string();
                    }
                    if (!options || !options.robot || options.robot.visible()) {
                        contents.set_visible(this.visible());
                    }
                } else if (TT.debugging) {
                    this._debug_string = this.to_debug_string();
                }
            };
            hole.get_contents_dimensions = function () {
                return {width:  $(this.get_frontside_element()).width(),
                        height: $(this.get_frontside_element()).height()};
            };
            hole.visible = function () {
                // if box is visible then hole is
                return this.get_parent_of_frontside().visible();
            };
            hole.set_visible = function (new_value, depth) {
                visible = new_value;
                if (contents) {
                    contents.set_visible(new_value, depth?depth+1:1);
                }
            };
            hole.remove = function () {
                if (contents) {
                    contents.remove();
                }
            };
            hole.render = function () {
                if (contents) {
                    TT.DISPLAY_UPDATES.pending_update(this);
                }
                // otherwise nothing to do
            };
            hole.rerender = function () {
                if (contents && this.visible()) {
                    return this.render();
                }
                // otherwise nothing to do
            };
            hole.set_running = function (new_value) {
                if (contents) {
                    contents.set_running(new_value);
                }
            };
            hole.set_parent = function (new_value) {
                if (contents) {
                    contents.set_parent(new_value);
                }
            };
            hole.maintain_proportional_dimensions = function () {
                if (contents) {
                    return contents.maintain_proportional_dimensions();
                }
            };
            hole.removed_from_container = function (part, event, index, report_error) {
                if (contents) {
                    if (event) {
                        contents.restore_dimensions();
                    }
                    this.set_contents(undefined);
                    if (event) {
                        this.get_parent_of_frontside().render();
                    }
                } else if (report_error) {
                    TT.UTILITIES.report_internal_error("Holes can't be removed from containers.");
                }
            };
            hole.temporarily_remove_contents = function (widget, update_display) {
                if (contents) {
                    // box should handle this
                    return this.get_parent_of_frontside().temporarily_remove_contents(widget, update_display);
                }
            };
            hole.toString = function () {
                if (contents) {
                    return contents.toString();
                }
                return "_";
            };
            hole.get_description = function () {
                if (contents) {
                    return contents.get_description();
                }
                return "_";
            };
            hole.get_full_description = function (to_string_info) {
                if (contents) {
                    return contents.get_full_description(to_string_info);
                }
                return "_";
            };
            hole.is_backside = function () {
                // holes are not quite first-class in that they don't have a backside
                return false;
            };
            hole.get_widget = function () {
                // used to return itself but the box is the 'real' widget
                return this.get_parent_of_frontside();
            };
            hole.is_number = function () {
                if (contents) {
                    return contents.is_number();
                }
                return false;
            };
            hole.is_box = function () {
                if (contents) {
                    return contents.is_box();
                }
                return false;
            };
            hole.is_scale = function () {
                if (contents) {
                    return contents.is_scale();
                }
                return false;
            };
            hole.is_bird = function () {
                if (contents) {
                    return contents.is_bird();
                }
                return false;
            };
            hole.is_nest = function () {
                if (contents) {
                    return contents.is_nest();
                }
                return false;
            };
            hole.is_robot = function () {
                if (contents) {
                    return contents.is_robot();
                }
                return false;
            };
            hole.is_element = function () {
                if (contents) {
                    return contents.dereference().is_element();
                }
                return false;
            };
            hole.get_original_width = function () {
                if (contents && contents.get_original_width) {
                    return contents.get_original_width();
                }
            };
            hole.get_original_height = function () {
                if (contents && contents.get_original_height) {
                    return contents.get_original_height();
                }
            };
            hole.is_sensor = function () {
                if (contents) {
                    return contents.is_sensor();
                }
                return false;
            };
            hole.is_top_level = function () {
                return false;
            };
            hole.is_plain_text_element = function () {
                return false;
            };
            hole.get_active = function () {
                if (contents) {
                    return contents.get_active();
                }
                return false;
            };
            hole.set_active = function (new_value, initialising) {
                if (contents) {
                    contents.set_active(new_value, initialising);
                }
            };
            TT.widget.has_parent(hole);
            TT.widget.has_listeners(hole);
            if (TT.debugging || TT.logging) {
                hole.to_debug_string = function (max_length) {
                    var info =  ("the " + TT.UTILITIES.ordinal(index) + " hole of the " +
                                 (this.get_parent_of_frontside() ? this.get_parent_of_frontside().to_debug_string() : "not-yet-defined box")).substring(0, max_length);
                    if (contents) {
                        return info + " which contains " + contents.to_debug_string(max_length);
                    }
                    return info + " which is empty";
                };
                hole._debug_string = hole.to_debug_string();
            }
            return hole;
        }
    };

}(window.TOONTALK));

window.TOONTALK.box.function =
(function () {
    var functions = TT.create_function_table();
    functions.add_function_object(
        'box hole',
        function (message, options) {
            var get_hole_contents = function (number, box, message_properties) {
                var n = Math.round(number.to_float());
                var contents;
                if (n < 1) {
                    functions.report_error("The 'box hole' function bird cannot find the " + TT.UTILITIES.ordinal(n-1) + " hole. She only accepts positive numbers.",
                                           message_properties);
                    return;
                }
                if (n > box.get_size()) {
                    functions.report_error("The 'box hole' function bird cannot cannot find the " + TT.UTILITIES.ordinal(number-1) + " hole. The box only has " + box.get_size() + " holes.",
                                           message_properties);
                    return;
                };
                contents = box.get_hole_contents(n-1);
                if (!contents) {
                    functions.report_error("The 'box hole' function bird cannot cannot find anything in the " + TT.UTILITIES.ordinal(number-1) + " hole. It is empty.",
                                           message_properties);
                    return;
                }
                if (message_properties.message_return_bird) {
                    return contents.copy();
                }
                return contents;
            };
            return functions.typed_bird_function(message, get_hole_contents, ['number', 'box'], 'box hole', options, 2, 2);
        },
        "The bird will return with what is in a hole of the box. The number determines which hole's contents are returned. Use 1 for the first hole.",
        "hole",
        ['number', 'box']);
    functions.add_function_object(
        'count holes',
        function (message, options) {
            var get_size = function (box) {
                return TT.number.create(box.get_size());
            };
            return functions.typed_bird_function(message, get_size, ['box'], 'count holes', options, 1, 1);
        },
        "The bird will return with the number of holes the box has.",
        "count holes",
        ['box']);
    functions.add_function_object(
        'fill hole',
        function (message, options) {
            var set_hole_contents = function (number, box, new_contents, message_properties) {
                var n = Math.round(number.to_float());
                if (n < 1) {
                    functions.report_error("The fill hole function bird cannot fill the " + TT.UTILITIES.ordinal(number) + " hole. She only accepts positive numbers.",
                                           message_properties);
                    return;
                }
                if (message_properties.message_return_bird) {
                    // don't clobber original message if it is being returned
                    box = box.copy();
                    new_contents = new_contents.copy();
                }
                if (n > box.get_size()) {
                    box.set_size(n);
                };
                box.set_hole(n-1, new_contents);
                return box;
            };
            return functions.typed_bird_function(message, set_hole_contents, ['number', 'box', undefined], 'fill hole', options, 3, 3);
        },
        "The bird will return with the box where one of its holes has been filled by whatever is in the fourth hole. The number determines which hole's contents are changed. 1 for the first hole.",
        "fill hole",
        ['number', 'box', undefined]);
    functions.add_function_object(
        'split box',
        function (message, options) {
            var split_box = function (number, box, message_properties) {
                var n = Math.round(number.to_float());
                var box_size = box.get_size();
                var box_of_boxes = function () {
                    var original_holes = box.get_holes();
                    // create a box with holes after n
                    var box2_size = box_size-n;
                    var box2 = TT.box.create(box2_size);
                    var i;
                    for (i = 0; i < box2_size; i++) {
                        box2.set_hole(i, box.get_hole_contents(i+n));
                    }
                     if (message_properties.message_return_bird) {
                        // avoid sharing any elements
                        box = box.copy();
                    }
                    // reduce original to n holes
                    box.set_size(n);
                    return TT.box.create(2, false, [box, box2]);
                };
                if (n < 0) {
                    functions.report_error("The box split function bird cannot split the box after " + number + " holes. She only accepts zero or positive numbers.",
                                           message_properties);
                    return;
                }
                if (n > box_size) {
                    functions.report_error("The box split function bird cannot split the box after " + number + " holes. The box only has " + box_size + " holes.",
                                           message_properties);
                    return;
                }
                return box_of_boxes();
            };
            return functions.typed_bird_function(message, split_box, ['number', 'box'], 'split box', options, 2, 2);
        },
        "The bird will return with a box with the original box split in two. The number determines where the split is. 1 for after the first hole.",
        "split",
        ['number', 'box']);
    functions.add_function_object(
        'merge boxes',
        function (message, options) {
            var merge_box = function () {
                var new_box_size = 0;
                var i, j, merged_box, merged_box_hole_index, box_size, contents, message_properties;
                if (arguments.length === 1) {
                    return TT.box.create(0);
                }
                message_properties = arguments[arguments.length-1]; // last argument is the properties of the message
                merged_box = arguments[0]; // reuse the first box
                if (message_properties.message_return_bird) {
                    // don't clobber original message if it is being returned
                    merged_box = merged_box.copy();
                }
                for (i = 0; i < arguments.length-1; i++) { // -1 since last argument is message_properties
                    new_box_size += arguments[i].get_size();
                }
                merged_box_hole_index = merged_box.get_size();
                merged_box.set_size(new_box_size);
                for (i = 1; i < arguments.length-1; i++) {
                    box_size = arguments[i].get_size();
                    for (j = 0; j < box_size; j++) {
                        contents = arguments[i].get_hole_contents(j);
                        if (contents) {
                            if (message_properties.message_return_bird) {
                                contents = contents.copy();
                            }
                            merged_box.set_hole(merged_box_hole_index, contents);
                        }
                        merged_box_hole_index++;
                    }
                }
                return merged_box;
            };
            return functions.typed_bird_function(message, merge_box, ['box'], 'merge boxes', options);
        },
        "The bird will return with a box that joins together all the boxes.",
        "merge",
        ['any number of boxes']);
    functions.add_function_object(
        'get window property',
        function (message, options) {
            var get_value = function (box, message_properties) {
                var value = window;
                var size = box.get_size();
                var full_path = function () {
                    var path = "window";
                    var i;
                    for (i = 0; i < size; i++) {
                        contents = box.get_hole_contents(i);
                        if (!contents || !contents.get_text) {
                            functions.report_error("The 'get window property' bird could not get the text of the " + TT.UTILITIES.ordinal(i) + " hole.", message_properties);
                            return;
                        }
                        path += "." + contents.get_text().trim();
                    }
                    return path;
                };
                var i, message, contents;
                for (i = 0; i < size; i++) {
                    contents = box.get_hole_contents(i);
                    if (!contents || !contents.get_text) {
                        functions.report_error("The 'get window property' bird could not get the text of the " + TT.UTILITIES.ordinal(i) + " hole.", message_properties);
                        return;
                    }
                    try {
                        value = value[contents.get_text().trim()];
                    } catch (exception) {
                        functions.report_error("Error trying to find the value of " + full_path() + ". " + exception, message_properties);
                        return;
                    }
                }
                if (value === undefined) {
                    functions.report_error("Error no value for " + full_path() + exception, message_properties);
                    return;
                }
                if (typeof value === 'number') {
                    return TT.number.create(value);
                }
                return TT.element.create(value.toString());
            };
            return functions.typed_bird_function(message, get_value, ['box'], 'window property', options, 1, 1);
        },
        "The bird will return with the value of the property accessed by each of the property names in the box.",
        "win prop",
        ['box']);
    functions.add_function_object(
        'set window property',
        function (message, options) {
            var set_value = function (box, new_value_as_widget, message_properties) {
                var properties = window;
                var size = box.get_size();
                var full_path = function (stop) {
                    var path = "window";
                    var i;
                    for (i = 0; i < stop; i++) {
                        contents = box.get_hole_contents(i);
                        if (!contents || !contents.get_text) {
                            functions.report_error("The 'set window property' bird could not get the text of the " + TT.UTILITIES.ordinal(i) + " hole.", message_properties);
                            return;
                        }
                        path += "." + contents.get_text().trim();
                    }
                    return path;
                };
                var i, new_value, message, contents;
                for (i = 0; i < size-1; i++) {
                    contents = box.get_hole_contents(i);
                    if (!contents || !contents.get_text) {
                        functions.report_error("The 'set window property' bird could not get the text of the " + TT.UTILITIES.ordinal(i) + " hole.", message_properties);
                        return;
                    }
                    try {
                        properties = properties[contents.get_text().trim()];
                    } catch (exception) {
                        functions.report_error("Error trying to find the property of " + full_path(size-1) + ". " + exception, message_properties);
                        return;
                    }
                }
                if (!properties) {
                    message = "Property missing of " + full_path(size-1);
                }
                if (!message) {
                    try {
                        if (new_value_as_widget.to_float) {
                            new_value = new_value_as_widget.to_float();
                        } else if (new_value_as_widget.get_text) {
                            new_value = new_value_as_widget.get_text();
                        } else {
                            new_value = new_value_as_widget.toString();
                        }
                        contents = box.get_hole_contents(size-1);
                        if (!contents || !contents.get_text) {
                            functions.report_error("The 'set window property' bird could not get the text of the " + TT.UTILITIES.ordinal(i) + " hole.", message_properties);
                            return;
                        }
                        properties[contents.get_text().trim()] = new_value;
                    } catch (exception) {
                        message = "Unable to set the value of " + full_path(size) + " to value of " + new_value_as_widget;
                    }
                }
                if (message) {
                    functions.report_error(message, message_properties);
                    return;
                }
                return new_value_as_widget;
            };
            return functions.typed_bird_function(message, set_value, ['box', undefined], 'set window property', options, 2, 2);
        },
        "The bird will set the value of the property accessed by each of the property names in the box in the second hole to the value of the widget in the third hole.",
        "set win prop",
        ['box']);
    return functions.get_function_table();
}
());

}(window.TOONTALK));
