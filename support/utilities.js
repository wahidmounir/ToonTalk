 /**
 * Implements ToonTalk's JavaScript functions shared between files
 * Authors: Ken Kahn
 * License: New BSD
 */
 
/*jslint browser: true, devel: true, plusplus: true, vars: true, white: true */

// jQuery.event.props.push('dataTransfer'); // some posts claim this needed -- unsure...

window.TOONTALK.UTILITIES = 
(function (TT) {
    "use strict";
    var dragee;
    var z_index = 100;
    var json_creators = {"box": TT.box.create_from_json,
                         "number": TT.number.create_from_json,
                         "robot": TT.robot.create_from_json,
                         "element": TT.element.create_from_json,
                         "bird": TT.bird.create_from_json,
                         "nest": TT.nest.create_from_json,
                         "sensor": TT.sensor.create_from_json,
                         "body": TT.actions.create_from_json,
                         "robot_action": TT.robot_action.create_from_json,
                         "box_path": TT.box.path.create_from_json,
                         "path.to_entire_context": TT.path.entire_context_create_from_json,
                         "path.top_level_backside": TT.path.top_level_backside.create_from_json,
                         "path.to_resource": TT.path.path_to_resource_create_from_json,
                         "newly_created_widgets_path": TT.newly_created_widgets_path.create_from_json,
                         "path.to_backside_widget_of_context": TT.path.path_to_backside_widget_of_context_create_from_json,
                         "path_to_style_attribute": TT.element.create_path_from_json,
                         "top_level": TT.widget.top_level_create_from_json,
                         "wand": TT.wand.create_from_json,
                         "vacuum": TT.vacuum.create_from_json};
    // id needs to be unique across ToonTalks due to drag and drop
    var id_counter = new Date().getTime();
    var div_open = "<div class='toontalk-json'>";
    var div_close = "</div>";
    var toontalk_json_div = function (json) {
        // convenience for dragging into documents (e.g. Word or WordPad -- not sure what else)
        return div_open + json + div_close;
    };
    var extract_json_from_div_string = function (div_string) {
        // expecting div_string to begin with div_open and end with div_close
        // but users may be dragging something different
        var json_start = div_string.indexOf('{');
        var json_end = div_string.lastIndexOf('}');
        if (json_start < 0 || json_end < 0) {
//             console.log("Paste missing JSON encoding.");
            return;
        }
        return div_string.substring(json_start, json_end+1);
    };
    var handle_drop = function ($target, $source, source_widget, target_widget, target_position, event, json_object, drag_x_offset, drag_y_offset, source_is_backside) {
        var new_target, backside_widgets_json, shared_widgets, top_level_backside_position;
        if ($target.is(".toontalk-backside")) {
            if (source_widget.get_type_name() === 'top-level') {
               // add all top-level backsides contents but not the backside widget itself
               backside_widgets_json = json_object.semantic.backside_widgets;
               shared_widgets = json_object.shared_widgets;
               source_widget.get_backside_widgets().forEach(function (backside_widget_side, index) {
                   // not clear why we need to copy these widgets but without copying
                   // their elements are not added to the target (but are added to its backside_widgets)
                   var widget = backside_widget_side.widget.copy();
//                    console.log("copy commented out since broken identities -- handle drop the problem???");
                   var json_view, backside_element, left_offset, top_offset, width, height, position;
                   if (backside_widgets_json[index].widget.shared_widget_index >= 0) {
                       json_view = shared_widgets[backside_widgets_json[index].widget.shared_widget_index].view;
                   } else {
                       json_view = backside_widgets_json[index].widget.view;
                   }
                   if (backside_widget_side.is_backside) {
                       backside_element = widget.get_backside_element(true);
                       left_offset = json_view.backside_left;
                       top_offset = json_view.backside_top;
                       width = json_view.backside_width;
                       height = json_view.backside_height;
                   } else {
                       backside_element = widget.get_frontside_element(true);
                       left_offset = json_view.frontside_left;
                       top_offset = json_view.frontside_top;
                       width = json_view.frontside_width;
                       height = json_view.frontside_height;
                   }
                   handle_drop($target, $(backside_element), widget, target_widget, target_position, event, json_object, 0, 0, backside_widget_side.is_backside);
                   position = $(backside_element).position();
                   $(backside_element).css({left: position.left + left_offset,
                                            top: position.top + top_offset,
                                            width: width,
                                            height: height});
                   if (backside_widget_side.is_backside) {
                       widget.backside_geometry = json_view.backside_geometry;
                       widget.apply_backside_geometry();
                   }
               }.bind(this));
               return;
            }
            // widget_dropped_on_me needed here to get geometry right
            if (source_widget) {
                target_widget.get_backside().widget_dropped_on_me(source_widget, source_is_backside, event);
            } else {
                console.log("No source_widget");
            }
            // should the following use pageX instead?
            // for a while using target_position.top didn't work while
            // $target.get(0).offsetTop did and then it stopped working
            // not sure what is happening or even whey they are different
            // consider also using layerX and layerY
            if (!drag_x_offset) {
                drag_x_offset = 0;
            }
            if (!drag_y_offset) {
                drag_y_offset = 0;
            }
            $source.css({
                left: event.originalEvent.pageX - (target_position.left + drag_x_offset),
                top:  event.originalEvent.pageY - (target_position.top  + drag_y_offset)
            });
//             if ($source.is(".toontalk-frontside") && !$source.is('.ui-resizable')) {
//                 // without the setTimeout the following prevents dragging components (e.g. widgets in boxes)
//                 setTimeout(function () {
//                     TT.UTILITIES.make_resizable($source, source_widget);
//                     },
//                     0);
//             }
            if (json_object && json_object.semantic.running) {
                source_widget.set_running(true);
            }
        } else if ($target.is(".toontalk-drop-area")) {
            $source.addClass("toontalk-widget-in-drop_area");
            $target.append($source.get(0));
            if ($source.is(".toontalk-robot")) {
                $target.data("drop_area_owner").set_next_robot(TT.UTILITIES.get_toontalk_widget_from_jquery($source));
            }
        } else if ($source.is(".toontalk-backside-of-top-level")) {
            // dragging top-level backside to itself or one of its children is ignored
            return;
        } else if (!target_widget) {
            console.log("target element has no 'owner'");
            return; // let event propagate
        } else {
            // before processing drop ensure that dropped item (source_widget) is visible and where dropped
            $(".toontalk-top-level-backside").append($source.get(0));
            top_level_backside_position = $(".toontalk-top-level-backside").offset();
            $source.css({
                left: event.originalEvent.pageX - (top_level_backside_position.left + drag_x_offset),
                top:  event.originalEvent.pageY - (top_level_backside_position.top  + drag_y_offset)}
            );
            if (source_widget.drop_on && source_widget.drop_on(target_widget, source_is_backside, event)) {
            } else if (target_widget.widget_dropped_on_me && target_widget.widget_dropped_on_me(source_widget, source_is_backside, event)) {
            } else {
                // ignore the current target and replace with the backside it is on
                new_target = $target.closest(".toontalk-backside");
                if (new_target.length > 0) {
                    target_widget = TT.UTILITIES.get_toontalk_widget_from_jquery(new_target);
                    if (target_widget) {
                        target_widget.get_backside().widget_dropped_on_me(source_widget, source_is_backside, event);
                        // place it directly underneath the original target
                        $source.css({
                            left: $target.position().left,
                            top:  $target.position().top + $target.height()
                        });
                    }
                }
            }
        }
//         if (target_widget && !drop_handled) {
//             // is the obsolete? If so is drop_handled?
//             if (target_widget.widget_dropped_on_me) {
//                 target_widget.widget_dropped_on_me(source_widget, source_is_backside, event);
//             }
//         }
    };
    var handle_drop_from_file_contents = function (file, $target, target_widget, target_position, event) {
        var reader = new FileReader();
        var image_file = file.type.indexOf("image") === 0;
        var widget, json, element_HTML;
        reader.onloadend = function () {
            if (image_file) {
                widget = TT.element.create("<img src='" + reader.result + "' alt='" + file.name + "'/>");
            } else {
                json = extract_json_from_div_string(reader.result);
                if (json) {
                    try {
                        widget = TT.UTILITIES.create_from_json(JSON.parse(json));
                    } catch (e) {
                        // no need to report this is need not contain ToonTalk JSON
                        // console.log("Exception parsing " + json + "\n" + e.toString());
                    }
                }
                if (!widget) {
                    // just use the text as the HTML
                    widget = TT.element.create(reader.result);
                }
            }
            handle_drop($target, $(widget.get_frontside_element(true)), widget, target_widget, target_position, event);
        }
        if (image_file) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    };
    var initialise = function () {
        var includes_top_level_backside = false;
        TT.debugging = true; // remove this for production releases
        $(".toontalk-json").each(
            function (index, element) {
                var json_string = element.textContent;
                var json, widget, frontside_element, backside_element, backside, stored_json_string;
                if (!json_string) {
                    return;
                }
                json = JSON.parse(json_string);
                widget = TT.UTILITIES.create_from_json(json);
                if (widget) {
                    element.textContent = ""; // served its purpose of being parsed as JSON
                    if (!widget.get_type_name) {
                        // isn't a widget. e.g. a tool
                        element.appendChild(widget.get_element());
                    } else if (widget.get_type_name() === 'top-level') {
                        if (window.location.href.indexOf("reset=1") < 0) {
                            try {
                                stored_json_string = window.localStorage.getItem(TT.UTILITIES.current_URL());
                            } catch (error) {
                                TT.UTILITIES.display_message("Error reading previous state. Error message is " + error);
                            }
                            if (stored_json_string) {
                                json = JSON.parse(stored_json_string);
                                widget = TT.UTILITIES.create_from_json(json);
                            }
                        }
                        backside = widget.get_backside(true);
                        backside_element = backside.get_element();
                        $(element).replaceWith(backside_element);
                        $(backside_element).css({width: json.view.backside_width,
                                                 height: json.view.backside_height,
                                                 // color may be undefined
                                                 // do the following in a more general manner
                                                 // perhaps using additional classes?
                                                 "background-color": json.view.background_color,
                                                 "border-width": json.view.border_width});
                        includes_top_level_backside = true;
                    } else {
                        $(element).addClass("toontalk-top-level-resource");
                        frontside_element = widget.get_frontside_element();
                        $(frontside_element).addClass("toontalk-top-level-resource");
                        element.appendChild(frontside_element);
                    }
                    if (widget.set_active) {
                        // resource shouldn't run -- at least not sensor nests
                        widget.set_active(false);
                    }
                    // delay until geometry settles down
                    setTimeout(function () {
                            if (widget.update_display) {
                                widget.update_display();
                            } // otherwise might be a tool
                            if (json.semantic.running) {
                                widget.set_running(true);
                            }
                        },
                    1);
                } else {
                    console.log("Could not recreate a widget from this JSON: " + json_string);
                }
            });
            if (!includes_top_level_backside) {
                // since there is no backside 'work space' need a way to turn things off
                $(document).click(function () {
                    $(".toontalk-frontside").each(function (index, element) {
                        var widget = element.toontalk_widget;
                        if (widget && widget.set_running) {
                            widget.set_running(false);
                        }
                    });
                });
            }
//             var backside = TT.backside.create(TT.widget.top_level_widget());
//             var backside_element = backside.get_element();
//             var $backside_element = $(backside_element);
//             $("body").append(backside_element);
//             $backside_element.addClass("toontalk-top-level-backside");
//             backside_element.draggable = false;
            TT.QUEUE.run();
            window.addEventListener('beforeunload', function (event) {
                TT.UTILITIES.backup_all(true);
//                 // following not needed if things are backed up to localStorage
//                 var message = "Have you saved your creations by dragging them to a program such as WordPad?";
//                 event.returnValue = message;
//                 return message;
            });
            // while developing
//             var sensor = TT.sensor.create("keydown", "keyCode");
//             $(".toontalk-top-level-backside").append(sensor.get_frontside_element(true));
        };
    var drag_ended = function () {
        if (!dragee) {
            return;
        }
        dragee.removeClass("toontalk-being-dragged");
        // restore events to decendants
        dragee.find("*").removeClass("toontalk-ignore-events");
        dragee = undefined;
    };
    $(document).ready(initialise);
    return {
        create_from_json: function (json, additional_info) {
            var widget, side_element, backside_widgets, json_semantic, json_view, size_css, json_of_shared_widget, shared_widget;
            if (!json) {
                // was undefined and still is
                return;
            }
            if (json.shared_widgets) {
                if (!additional_info) {
                    additional_info = {};
                }
                additional_info.json_of_shared_widgets = json.shared_widgets;
                additional_info.shared_widgets = [];
            }
            if (json.widget) {
                // is a context where need to know which side of the widget
                return {widget: TT.UTILITIES.create_from_json(json.widget, additional_info),
                        is_backside: json.is_backside};
            }
            if (json.shared_widget_index >= 0) {
                shared_widget = additional_info.shared_widgets[json.shared_widget_index];
                if (shared_widget) {
//                     if (shared_widget.shared_widget_index >= 0) {
//                         console.log("Warning cyclic JSON not fully supported")
//                         // this isn't a widget but a promise of one -- so must be a cycle
//                         if (!additional_info.cyclic_widgets_json) {
//                             additional_info.cyclic_widgets_json = [];
//                         }
//                         if (additional_info.cyclic_widgets_json.indexOf(shared_widget) < 0) {
//                             additional_info.cyclic_widgets_json.push(shared_widget);
//                         }
//                     }
                    return shared_widget;
                }
                // otherwise create it from the JSON and store it
                json_of_shared_widget = additional_info.json_of_shared_widgets[json.shared_widget_index];
                // following is to deal with reconstructing cyclic references
                // if this is encountered again recursively will discover the JSON with shared_widget_index
//                 additional_info.shared_widgets[json.shared_widget_index] = json;
                widget = TT.UTILITIES.create_from_json(json_of_shared_widget, additional_info);
//                 if (additional_info.cyclic_widgets_json && typeof json_of_shared_widget.shared_widget_index === 'undefined') {
//                     if (additional_info.cyclic_widgets_json.indexOf(json) >= 0) {
//                         // contains cyclic references so make json into the widget
//                         // clobber json to have all the (deep) properties of the widget
//                         $.extend(true, json, widget);
//                         json.shared_widget_index = undefined;
//                         // all references shared including the top-level one
//                         widget = json;
//                     }
//                 }
                additional_info.shared_widgets[json.shared_widget_index] = widget;              
                return widget;
            }
            json_semantic = json.semantic;
            if (!json_semantic) {
                // e.g. body, paths, etc.
                json_semantic = json;
            }
            json_view = json.view;
            if (json_creators[json_semantic.type]) {
                if (!additional_info) {
                    additional_info = {};
                }
                if (json_view) {
                    additional_info.json_view = json_view;
                } else {
                    json_view = additional_info.json_view;
                }
                widget = json_creators[json_semantic.type](json_semantic, additional_info);
               // following was needed when get_json_top_level wasn't working properly
//             } else if (json_semantic.shared_widget_index >= 0) {
//                 widget = additional_info.shared_widgets[json_semantic.shared_widget_index];
//                 if (!widget) {
//                     // try again with the JSON of the shared widget
//                     widget = TT.UTILITIES.create_from_json(additional_info.json_of_shared_widgets[json_semantic.shared_widget_index], additional_info);
//                 }
            } else {
                console.log("json type '" + json_semantic.type + "' not yet supported.");
                return;
            }
            if (widget && widget.get_backside) {
                // widget may be a robot body or some other part of a widget
                if (json_semantic.erased) {
                    TT.widget.erasable(widget);
                    widget.set_erased(json_semantic.erased);
                }
                if (json_semantic.infinite_stack) {
                    widget.set_infinite_stack(json_semantic.infinite_stack);
                }
                if (json_view && json_view.frontside_width) {
                    side_element = json_view.backside ? widget.get_backside(true).get_element() : widget.get_frontside_element();
                    size_css = {width: json_view.frontside_width,
                                height: json_view.frontside_height};
                    if (json_semantic.type === 'element') {
                        // delay until updated
                        widget.on_update_display(function () {
                                                     $(side_element).css(size_css);
                                                     $(side_element).find("img").css(size_css);
                                                 });
                    } else {
                        $(side_element).css(size_css);
                    }
                }
                if (json_view && json_view.saved_width) {
                    widget.saved_width =  json_view.saved_width;
                    widget.saved_height = json_view.saved_height;
                }
                if (json_view && json_view.backside_geometry) {
                    widget.backside_geometry = json_view.backside_geometry;                    
                }
                if (json_semantic.backside_widgets) {
                    backside_widgets = this.create_array_from_json(json_semantic.backside_widgets, additional_info);
                    widget.set_backside_widget_sides(backside_widgets, 
                                                     json_semantic.backside_widgets.map(
                                                        function (json) {
                                                            if (json.widget.shared_widget_index >= 0) {
                                                                return additional_info.json_of_shared_widgets[json.widget.shared_widget_index].view;
                                                            }
                                                            return json.widget.view; 
                                                     }));
                }
            }
            return widget;
        },
        
        create_array_from_json: function (json_array, additional_info) {
            var new_array = [];
            json_array.forEach(function (json_item, index) {
                if (json_item) {
                    new_array[index] = TT.UTILITIES.create_from_json(json_item, additional_info);
                } else {
                    // e.g. could be null representing an empty hole
                    new_array[index] = json_item; 
                }
            });
            return new_array;
        },
        
        get_json_of_array: function (array, json_history) {
            var json = [];
            var widgets_jsonified = [];
            array.forEach(function (widget_side, index) {
                if (widget_side) {
                    if (!widget_side.widget) {
                        if (widget_side.get_type_name) {
                            json[index] = TT.UTILITIES.get_json(widget_side, json_history);
                        } else {
                            // isn't a widget -- e.g. is a path
                            json[index] = widget_side.get_json(json_history);
                        }
                    } else if (widget_side.widget.get_json) {
                        json[index] = {widget: TT.UTILITIES.get_json(widget_side.widget, json_history),
                                       is_backside: widget_side.is_backside};
                    } else {
                        console.log("No get_json for " + array[i].toString());
                    }
                }
            });
            return json;
        },
        
        get_json_top_level: function (widget) {
            var json_history = {widgets_encountered: [],
                                shared_widgets: [],
                                json_of_widgets_encountered: []};
            var json = TT.UTILITIES.get_json(widget, json_history);
            if (json_history.shared_widgets.length > 0) {
                json.shared_widgets = json_history.shared_widgets.map(function (widget, widget_index) {
                    // get the JSON of only those widgets that occurred more than once
                    var get_json_of_widget_from_history = function (widget) {
                        var index_among_all_widgets = json_history.widgets_encountered.indexOf(widget);
                         return json_history.json_of_widgets_encountered[index_among_all_widgets];
                    };
                    var get_json_of_widget_from_shared_widget_index = function (index) {
                        return get_json_of_widget_from_history(json_history.shared_widgets[index]);
                    }
                    var json_of_widget = get_json_of_widget_from_history(widget);
                    // start searching tree for json_of_widget with the semantic component
                    // because json might === json_of_widget
                    TT.UTILITIES.tree_replace_once(json.semantic, json_of_widget, {shared_widget_index: widget_index}, get_json_of_widget_from_shared_widget_index);
                    return json_of_widget;
                });
            }
            return json;
        },
        
        get_json: function (widget, json_history) {
            var index, widget_json;
            if (TT.debugging && !json_history) {
                console.log("no json_history");
            }
            index = json_history.shared_widgets.indexOf(widget);
            if (index >= 0) {
                return {shared_widget_index: index};
            }
            index = json_history.widgets_encountered.indexOf(widget);
            if (index >= 0) {
                // need to process children before ancestors when generating the final JSON
                index = TT.UTILITIES.insert_ancestors_last(widget, json_history.shared_widgets);
                return {shared_widget_index: index};
            }
            // need to keep track of the index rather than push json_of_widgets_encountered to keep them aligned properly
            index = json_history.widgets_encountered.push(widget)-1;
            widget_json = widget.get_json(json_history);
            widget_json = widget.add_to_json(widget_json, json_history);
            // need to push the widget on the list before computing the backside widget's jSON in case there is a cycle
            json_history.json_of_widgets_encountered[index] = widget_json;
            if (widget.add_backside_widgets_to_json) {
                widget.add_backside_widgets_to_json(widget_json, json_history);
            }
            return widget_json;
        },
        
        tree_replace_once: function (object, replace, replacement, get_json_of_widget_from_shared_widget_index) {
            // returns object with the first occurence of replace replaced with replacement
            // whereever it occurs in object
            var value;
            for (var property in object) {
                if (object.hasOwnProperty(property)) {
                    value = object[property];
                    if (value === replace) {
                        object[property] = replacement;
                        return true;
                    } else if (property === 'shared_widget_index') {
                        if (this.tree_replace_once(get_json_of_widget_from_shared_widget_index(value), replace, replacement, get_json_of_widget_from_shared_widget_index)) {
                            return true;
                        }
                    } else if (["string", "number", "function"].indexOf(typeof value) >= 0) {
                        // skip atomic objects
                    } else if (this.tree_replace_once(value, replace, replacement, get_json_of_widget_from_shared_widget_index)) {
                        return true;
                    }
                }
            }
            return false;            
        },

        insert_ancestors_last: function (widget, array_of_widgets) {
            // inserts widget before any of its ancestors into the array
            // returns the index of the widget
            var insertion_index = -1;
            array_of_widgets.some(function (other, index) {
                if (widget.has_ancestor(other)) {
                    insertion_index = index;
                    return true;
                }
            });
            if (insertion_index < 0) {
                insertion_index = array_of_widgets.length;
            }
            array_of_widgets.splice(insertion_index, 0, widget);
            return insertion_index;
        },
        
//         tree_replace_all: function (object, replace, replacement) {
//             // returns object with all occurences of replace replaced with replacement
//             // whereever it occurs in object
//             var value;
//             for (var property in object) {
//                 if (object.hasOwnProperty(property)) {
//                     value = object[property];
//                     if (value === replace) {
//                         object[property] = replacement;
//                     } else if (["string", "number", "function"].indexOf(typeof value) < 0) {
//                         // recur on non-atomic objects
//                         this.tree_replace_all(value, replace, replacement);
//                     }
//                 }
//             }      
//         },
        
        copy_widgets: function (widgets, just_value) {
            // rewrite using map
            var widgets_copy = [];
            var i;
            for (i = 0; i < widgets.length; i++) {
                widgets_copy[i] = widgets[i] && widgets[i].copy(just_value);
            }
            return widgets_copy;
        },
        
        copy_widget_sides: function (widget_sides, just_value) {
            return widget_sides.map(function (widget_side) {
                return {widget: widget_side.widget.copy(just_value),
                        is_backside: widget_side.is_backside};
            });
        },
        
        copy_array: function (array) {
            return array.slice();
        },
        
        generate_unique_id: function () {
            id_counter += 1;
            return 'toontalk_id_' + id_counter;
        },
        
        get_style_property: function (element, style_property) {
            if (element.currentStyle) {
                return element.currentStyle[style_property];
            } 
            if (window.getComputedStyle) {
                 return document.defaultView.getComputedStyle(element, null).getPropertyValue(style_property);
            }
        },

        get_style_numeric_property: function (element, style_property) {
            var as_string = this.get_style_property(element, style_property);
            var index;
            if (typeof as_string === 'string') {
                index = as_string.indexOf('px');
                if (index >= 0) {
                    as_string = as_string.substring(0, index);
                }
                return parseInt(as_string, 10);
            }
            return as_string;
        },
        
        data_transfer_json_object: function (event) {
            var data, json;
            if (!event.originalEvent.dataTransfer) {
                console.log("no dataTransfer in drop event");
                return;
            }
            // following code could be simplified by using event.originalEvent.dataTransfer.types
            // unless in IE9 should use text/html to enable dragging of HTML elements
            try {
                // the following causes errors in IE9
                data = event.originalEvent.dataTransfer.getData("text/html");
            } catch (e) {
                // should only occur in IE9
                data = event.originalEvent.dataTransfer.getData("text");
            }
            if (!data || data.match(/[\u3400-\u9FBF]/)) {
                // match(/[\u3400-\u9FBF]/) tests for Chinese which FireFox does
                // see https://bugzilla.mozilla.org/show_bug.cgi?id=900414
                // may not have been text/html but just plain text
                data = event.originalEvent.dataTransfer.getData("text");
//                 if (data) {
//                     data = "<div class='ui-widget'>" + data + "</div>";
//                 }
            }
            if (!data) {
                console.log("No data in dataTransfer in drop.");
                return;
            }
            json = extract_json_from_div_string(data);
            if (!json) {               
                return TT.UTILITIES.get_json_top_level(TT.element.create(data));
            }
            try {
                return JSON.parse(json);
            } catch (e) {
                console.log("Exception parsing " + json + "\n" + e.toString());
            }
        },
        
        drag_and_drop: function ($element) {
            TT.UTILITIES.draggable($element);
            TT.UTILITIES.can_receive_drops($element);
        },
        
        draggable: function ($element) {
            $element.attr("draggable", true);
            // JQuery UI's draggable causes dataTransfer to be null
            // rewrote after noticing that this works fine: http://jsfiddle.net/KWut6/
            $element.on('dragstart', 
                function (event) {
                    var $source_element = $(event.originalEvent.srcElement).closest(".toontalk-side");
                    var bounding_rectangle, json_object, json_div, widget, is_resource;
                    // was using text/plain but IE complained
                    // see http://stackoverflow.com/questions/18065840/html5-drag-and-drop-not-working-on-ie11
                    if (event.originalEvent.dataTransfer.getData("text").length > 0) {
                        // e.g. dragging some text off the backside of a widget
                        return;
                    }
                    dragee = ($source_element || $element);
                    widget = TT.UTILITIES.get_toontalk_widget_from_jquery(dragee);
                    if (!widget) {
                        widget = TT.UTILITIES.get_toontalk_widget_from_jquery($element);
                        console.log("Possible bug that " + dragee + " doesn't have a known owner.");
                        dragee = $element;
                    }
                    bounding_rectangle = dragee.get(0).getBoundingClientRect()
                    is_resource = dragee.is(".toontalk-top-level-resource");
//                     if (dragee.is(".toontalk-frontside")) {
//                         // save the current dimension so size doesn't change while being dragged
//                         dragee.css({width:  bounding_rectangle.width,
//                                     height: bounding_rectangle.height});
//                     }
                    if (event.originalEvent.dataTransfer && widget.get_json) {
                        event.originalEvent.dataTransfer.effectAllowed = is_resource ? 'copy' : 'move';
                        json_object = TT.UTILITIES.get_json_top_level(widget);
                        // not sure if the following is obsolete
                        json_object.view.drag_x_offset = event.originalEvent.clientX - bounding_rectangle.left;
                        json_object.view.drag_y_offset = event.originalEvent.clientY - bounding_rectangle.top;
                        if (!json_object.view.frontside_width) {
                            if (dragee.parent().is(".toontalk-backside")) {
                                json_object.view.frontside_width = dragee.width();
                                json_object.view.frontside_height = dragee.height();
                            }
                        }
                        if (dragee.is(".toontalk-backside")) {
                            json_object.view.backside = true;
                        }
                        dragee.data("json", json_object);
                        // use two spaces to indent each level
                        json_div = toontalk_json_div(JSON.stringify(json_object, null, '  '));
                        event.originalEvent.dataTransfer.setData("text/html", json_div);
                        // the above causes IE9 errors when received so the following added just for IE9
                        event.originalEvent.dataTransfer.setData("text", json_div);
                        widget.drag_started(json_object, is_resource);
                    }
                    dragee.addClass("toontalk-being-dragged");
                    event.stopPropagation();
//                  console.log("drag start. dragee is " + dragee);
                });
            $element.on('dragend', 
                function (event) {
//                  console.log("drag end. dragee is " + dragee);
                    if (!dragee) {
                        dragee = $(event.originalEvent.srcElement).closest(".toontalk-side");
                    }
                    if (dragee.is(".toontalk-frontside")) {
                        if (dragee.parent().is(".toontalk-backside")) {
                            // restore ordinary size styles
                            var json_object = dragee.data("json");
                            if (json_object) {
                                dragee.data("json", ""); // no point wasting memory on this anymore
                                dragee.css({width:  json_object.view.frontside_width,
                                            height: json_object.view.frontside_height});
                            }
                        } else if (!dragee.parent().is(".toontalk-top-level-resource, .toontalk-drop-area") &&
                                   !dragee.is(".toontalk-carried-by-bird") &&
                                   !TT.UTILITIES.has_animating_image(dragee.get(0))) {
                            dragee.css({width:  "100%",
                                        height: "100%"});
                        }
                    }
                    drag_ended();
                    event.stopPropagation();
                });       
        },
        
        can_receive_drops: function ($element) {
            $element.on('dragover',
                function (event) {
                    // think about drop feedback
                    event.preventDefault();
                    return false;
                });
            $element.on('drop',
                function (event) {
                    var $source, source_widget, $target, target_widget, drag_x_offset, drag_y_offset, target_position, 
                        new_target, source_is_backside, $container, container, width, height, i;
                    var json_object = TT.UTILITIES.data_transfer_json_object(event);
                    // should this set the dropEffect? https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer#dropEffect.28.29 
                    // prevent default first so if there is an exception the default behaviour for some drags of going to a new page is prevented
                    event.preventDefault();
                    // restore events to decendants
                    $element.find("*").removeClass("toontalk-ignore-events");
//                     console.log("drop. dragee is " + dragee);
                    $source = dragee;
                    drag_ended();
                    if (!$source && !json_object && !event.originalEvent.dataTransfer.files) {
                        if (!event.originalEvent.dataTransfer) {
                            console.log("Drop failed since there is no event.originalEvent.dataTransfer");
                        } else {
                            console.log("Drop failed since unable to parse as JSON."); 
                        }
                        // without the following it may load a new page
                        event.stopPropagation();
                        return;
                    }
                    if ($(event.target).is(".toontalk-drop-area-instructions")) {
                        $target = $(event.target).parent();
                    } else if ($(event.target).is(".toontalk-element-attribute-input")) {
                        // should work for any input -- need to generalise this
                        $target = $(event.target).closest(".toontalk-side");
                        target_widget = TT.UTILITIES.get_toontalk_widget_from_jquery($target);
                        if (target_widget) {
                            if ($source) {
                                source_widget = TT.UTILITIES.get_toontalk_widget_from_jquery($source);
                            } else {
                                source_widget = TT.UTILITIES.create_from_json(json_object);
                            }
                            TT.UTILITIES.restore_resource($source, source_widget);
                            target_widget.dropped_on_style_attribute(source_widget, event.target.name, event);
                            event.stopPropagation();
                            return;
                        }
                    } else if ($(event.target).is(".toontalk-drop-area")) {
                        $target = $(event.target);
                    } else {
                        // closest includes 'self'
                        $target = $(event.target).closest(".toontalk-side");
                    }
                    if ($target.length === 0) {
                        return;
                    }
                    if ($target.is(".toontalk-top-level-resource")) {
                        // maybe should ensure they are not drop targets
                        return;
                    }
                    // if this is computed when needed and if dragging a resource it isn't the correct value
                    target_position = $target.offset();
                    $target.removeClass("toontalk-highlight");
                    if ($source && $source.length > 0 &&
                        ($source.get(0) === $target.get(0) || jQuery.contains($source.get(0), $target.get(0)))) {
                        if ($source.is(".toontalk-top-level-backside")) {
                            return; // let event propagate since this doesn't make sense
                        }
                        // not dropping on itself but on the widget underneath
                        // to not find $target again temporarily hide it
                        $target.hide();
                        new_target = document.elementFromPoint(event.originalEvent.pageX, event.originalEvent.pageY);
                        $target.show();
                        if (new_target) {
                            $target = $(new_target).closest(".toontalk-side");
                            target_position = $target.offset();
                        }
                    }
                    target_widget = TT.UTILITIES.get_toontalk_widget_from_jquery($target);
                    if (json_object && json_object.view && json_object.view.drag_x_offset) {
                        drag_x_offset = json_object.view.drag_x_offset;
                        drag_y_offset = json_object.view.drag_y_offset;
                    } else {
                        drag_x_offset = 0;
                        drag_y_offset = 0;
                    }
                    if ($source && $source.length > 0) {
                        if ($source.get(0) === $target.get(0) || jQuery.contains($source.get(0), $target.get(0))) {
                            // dropped of itself or dropped on a part of itself
                            // just moved it a little bit
                            // only called now that elementFromPoint is used to find another target when dropped on part of itself
                            $source.css({left: $source.get(0).offsetLeft + (event.originalEvent.layerX - drag_x_offset),
                                          top: $source.get(0).offsetTop + (event.originalEvent.layerY - drag_y_offset)});
                            event.stopPropagation();
                            return;
                        }
                        source_is_backside = $source.is(".toontalk-backside");
                        source_widget = TT.UTILITIES.get_toontalk_widget_from_jquery($source);
                        if ($source.parent().is(".toontalk-drop-area")) {
                            $source.removeClass("toontalk-widget-in-drop_area");
                            $source.parent().data("drop_area_owner").set_next_robot(undefined);
                        } else {
                            $container = $source.parents(".toontalk-side:first");
                            container = TT.UTILITIES.get_toontalk_widget_from_jquery($container);
                            if (container) {
                                if (!source_is_backside && source_widget.get_infinite_stack && source_widget.get_infinite_stack()) {
                                    // leave the source there but create a copy
                                    source_widget = source_widget.copy();
                                    width = $source.width();
                                    height = $source.height();
                                    $source = $(source_widget.get_frontside_element(true));
                                    if ($target.is(".toontalk-backside")) {
                                        // if original dimensions available via json_object.view use it
                                        // otherwise copy size of infinite_stack
                                        $source.css({width:  json_object.view.frontside_width || width,
                                                     height: json_object.view.frontside_height || height});
                                    }
                                } else if (container.removed_from_container) {
                                    $source.removeClass("toontalk-widget-on-nest");
                                    // can be undefined if container is a robot holding something
                                    // but probably that should be prevented earlier
                                    if ($container.is(".toontalk-backside")) {
                                        container.remove_backside_widget(source_widget, source_is_backside);
                                    } else {
                                        container.removed_from_container(source_widget, source_is_backside, event);
                                    }
                                }
                            } else {
                                TT.UTILITIES.restore_resource($source, source_widget);
                            }
                            if (TT.robot.in_training) {
                                // maybe have been copied
                                // or removed from a container (and not 'seen' before)
                                TT.robot.in_training.add_newly_created_widget_if_new(source_widget);
                            }
                        }
                    } else {
                        if (event.originalEvent.dataTransfer.files.length > 0) {
                            // forEach doesn't work isn't really an array
                            for (i = 0; i < event.originalEvent.dataTransfer.files.length; i++) {
                                handle_drop_from_file_contents(event.originalEvent.dataTransfer.files[i], $target, target_widget, target_position, event);
                            };
                            event.stopPropagation();
                            return;
                        } else {
                            source_widget = TT.UTILITIES.create_from_json(json_object, {event: event});
                        }
                        if (!source_widget) {
                            console.log("Unable to construct a ToonTalk widget from the JSON.");
                            event.stopPropagation();
                            return;
                        }
                        source_is_backside = json_object.view.backside;
                        if (source_is_backside) {
                            $source = $(source_widget.get_backside_element());
                            $source.css({width: json_object.view.backside_width,
                                         height: json_object.view.backside_height,
                                         // color may be undefined
                                         "background-color": json_object.view.background_color,
                                         "border-width": json_object.view.border_width});
                            source_widget.apply_backside_geometry();
                        } else {
                            $source = $(source_widget.get_frontside_element());
                        }
                    }    
                    if (source_widget === target_widget) {
                        // dropping front side on back side so ignore
                        event.stopPropagation();
                        return;
                    }
                    handle_drop($target, $source, source_widget, target_widget, target_position, event, json_object, drag_x_offset, drag_y_offset, source_is_backside);
                    event.stopPropagation();
                });
            $element.on('dragenter', function (event) {
//              console.log($element.get(0).className); -- not clear why this is never triggered for inputs on backside
//              probably because backside itself has a dragenter?
                if (!$element.is(".toontalk-top-level-backside") && 
                    !$element.is(".toontalk-top-level-resource") &&
                    !$element.is(".toontalk-being-dragged")) {
                    $element.addClass("toontalk-highlight");
                    // moving over decendants triggers dragleave unless their pointer events are turned off
                    // they are restored on dragend
                    if (!$element.is(".toontalk-backside, .toontalk-drop-area") && TT.UTILITIES.get_toontalk_widget_from_jquery($element).get_type_name() !== 'box') {
                        // this breaks the dropping of elements on empty holes so not supported
                        $element.find(".toontalk-side").addClass("toontalk-ignore-events");
                        // except for toontalk-sides and their ancestors since they are OK to drop on
                        // following was intended to deal with box holes but didn't work
//                         $element.find(".toontalk-side").parents().removeClass("toontalk-ignore-events");
                    }
                }
                event.stopPropagation();
            });
            $element.on('dragleave', function (event) {
                if (!$element.is(".toontalk-top-level-backside") && !$element.is(".toontalk-top-level-resource")) {
                    $element.removeClass("toontalk-highlight");
                }
                event.stopPropagation();
            });
            // following attempt to use JQuery UI draggable provides mouseevents rather than dragstart and the like
            // and they don't have a dataTransfer attribute so forced to rely upon lower-level drag and drop functionality
//             $element.draggable({
//                 create: function (event, ui) {
//                     $(this).css({position: "absolute"})
//                 },
// //                  appendTo: $element.parents(".toontalk-side:last"), // top-most
//                 greedy: true,
// //                 containment: false, // doesn't seem to work... -- nor does "none"
//                 stack: ".toontalk-side",
//             }); 
        },
        
        create_drop_area: function (instructions) {
            // instructions can be HTML or plain text
            var $drop_area = $(document.createElement("div"));
            var drop_area_instructions = document.createElement("div");
            drop_area_instructions.innerHTML = instructions;
            $(drop_area_instructions).addClass("toontalk-drop-area-instructions ui-widget");
            $drop_area.addClass("toontalk-drop-area");
            $drop_area.append(drop_area_instructions);
            TT.UTILITIES.can_receive_drops($drop_area);
            return $drop_area;
        },
        
//         absolute_position: function ($element) {
//             var element_position;
//             var absolute_position = {left: 0, top: 0};
//             while ($element.parent().length > 0) {
//                 element_position = $element.position();
//                 absolute_position.left += element_position.left;
//                 absolute_position.top += element_position.top;
//                 $element = $element.parent();
//             }
//             return absolute_position;
//         },
        
        set_absolute_position: function ($element, absolute_position) {
            var $ancestor = $element.parent();
            var left = absolute_position.left;
            var top =  absolute_position.top;
            var ancestor_position;
            while (!$ancestor.is("html")) {
                ancestor_position = $ancestor.position();
                left -= ancestor_position.left;
                top  -= ancestor_position.top;
                $ancestor = $ancestor.parent();
            }
            $element.css({left: left,
                          top:  top,
                          position: "absolute"});
        },
        
        restore_resource: function ($dropped, dropped_widget) {
            var dropped_copy, dropped_element_copy;
            if ($dropped.is(".toontalk-top-level-resource")) {
                // restore original
                dropped_copy = dropped_widget.copy(false, true);
                dropped_element_copy = dropped_copy.get_frontside_element();
                $(dropped_element_copy).css({width:  $dropped.width(),
                                             height: $dropped.height()});
                $dropped.removeClass("toontalk-top-level-resource");
                $(dropped_element_copy).addClass("toontalk-top-level-resource");
                $dropped.get(0).parentElement.appendChild(dropped_element_copy);
//                 $dropped.parent().append(dropped_element_copy);
                TT.DISPLAY_UPDATES.pending_update(dropped_copy);
                if (dropped_widget.set_active) {
                    dropped_widget.set_active(true);
                    dropped_copy.set_active(false);
                }
            }
        },
        
        find_resource_equal_to_widget: function (widget) {
            var element_found;
            $(".toontalk-top-level-resource").each(function (index, element) {
                var $resource_element = $(element).children(":first");
                var owner = TT.UTILITIES.get_toontalk_widget_from_jquery($resource_element);
                if (owner && ((widget.equals && widget.equals(owner)) ||
                              ((widget.matching_resource && widget.matching_resource(owner))))) {
                    element_found = $resource_element.get(0);
                    return false; // stop the 'each'
                }
            });
            return element_found;
        },
        
        set_position_is_absolute: function (element, absolute, event) {
            var position, left, top, ancestor;
            if (event) {
                // either DOM or JQuery event
                if (event.originalEvent) {
                    event = event.originalEvent;
                }
            }
            if (absolute) {
                position = $(element).position();
                left = position.left;
                top = position.top;
                $(element).css({left: left,
                                 top: top,
                                 position: "absolute"});
            } else {
                element.style.position = "static";
            }
        },
        
        cardinal: function (n) {
            switch (n) {
                case 0:
                return "first";
                case 1:
                return "second";
                case 2:
                return "third";
                default:
                return n + "th";
            }
        },
            
        on_a_nest_in_a_box: function (frontside_element) {
            return $(frontside_element).closest(".toontalk-nest").is("*") && $(frontside_element).closest(".toontalk-box").is("*");
        },
        
        add_one_shot_event_handler: function (element, event_name, maximum_wait, handler) {
            // could replace the first part of this by http://api.jquery.com/one/
            var handler_run = false;
            var one_shot_handler = function (event) {
                // could support any number of parameters but not needed
                handler_run = true;
                if (handler) {
//                  console.log("event " + event + " at " + new Date());
                    handler();
                }
                element.removeEventListener(event_name, one_shot_handler);
            }
            element.addEventListener(event_name, one_shot_handler);
            // transitionend events might not be triggered
            // As https://developer.mozilla.org/en-US/docs/Web/Guide/CSS/Using_CSS_transitions says: 
            // The transitionend event doesn't fire if the transition is aborted because the animating property's value is changed before the transition is completed.
            setTimeout(
                function () {
                    if (!handler_run) {
//                         if (TT.debugging) {
//                             console.log("Timed out after " + maximum_wait +"ms while waiting for " + event_name);
//                         }
                        one_shot_handler();
                    }
                },
                maximum_wait);
        },
        
        animate_to_absolute_position: function (source_element, target_absolute_position, continuation, speed, more_animation_follows) {
            var source_absolute_position = $(source_element).offset();
            var source_relative_position = $(source_element).position();
            var distance = TT.UTILITIES.distance(target_absolute_position, source_absolute_position);
            var remove_transition_class, duration;
            if (!speed) {
                speed = .5; // a half a pixel per millisecond -- so roughly two seconds to cross a screen
            }
            duration = Math.round(distance/speed);
            $(source_element).addClass("toontalk-side-animating");
            source_element.style.transitionDuration = duration+"ms";
            source_element.style.left = (source_relative_position.left + (target_absolute_position.left - source_absolute_position.left)) + "px";
            source_element.style.top =  (source_relative_position.top  + (target_absolute_position.top -  source_absolute_position.top )) + "px";
            if (!more_animation_follows) {
                remove_transition_class = function () {
                    $(source_element).removeClass("toontalk-side-animating");
                    source_element.style.transitionDuration = '';
                };
                // if transitionend is over 500ms late then run handler anyway
                TT.UTILITIES.add_one_shot_event_handler(source_element, "transitionend", duration+500, remove_transition_class);
            }
            TT.UTILITIES.add_one_shot_event_handler(source_element, "transitionend", duration+500, continuation);
        },
        
        distance: function (position_1, position_2) {
            var delta_x = position_1.left-position_2.left;
            var delta_y = position_1.top-position_2.top;
            return Math.sqrt(delta_x*delta_x+delta_y*delta_y);
        },
        
        highlight_element: function (element, duration) {
            $(element).addClass("toontalk-highlight");
            if (duration) {
                setTimeout(function () {
                        TT.UTILITIES.remove_highlight_from_element(element);
                    },
                    duration);
            }
        },

        remove_highlight_from_element: function (element) {
            $(element).removeClass("toontalk-highlight");
        },          
        
        cursor_of_image: function (url) {
            var extensionStart = url.lastIndexOf('.');
            if (extensionStart >= 0) {
                return url.substring(0, extensionStart) + ".32x32" + url.substring(extensionStart);
            }
            return url;
        },
        
        next_z_index: function () {
            z_index++;
            return z_index;
        },
                
        create_close_button: function (handler, title) {
            var close_button = document.createElement("div");
            $(close_button).addClass("toontalk-close-button");
            $(close_button).click(handler);
            $(close_button).attr("title", title);
            return close_button;
        },
        
        check_radio_button: function (button_elements) {
            $(button_elements.button).prop("checked", true);
            $(button_elements.label).addClass('ui-state-active');
        },
        
        create_button_set: function () { 
            // takes any number of parameters, any of which can be an array of buttons
            var container = document.createElement("div");
            var i, j;
            // arguments isn't an ordinary array so can't use forEach
            for (i = 0; i < arguments.length; i++) {
                if (arguments[i].length >= 0) {
                    for (j = 0; j < arguments[i].length; j++) {
                        container.appendChild(arguments[i][j]);
                    }
                } else { 
                    container.appendChild(arguments[i]);
                }
            }
            $(container).buttonset();
            return container;
        },
        
        create_text_element: function (text) {
            var div = document.createElement("div");
            div.textContent = text;
            $(div).addClass('ui-widget');
            return div;
        },
        
        create_anchor_element: function (html, url) {
            var anchor = document.createElement("a");
            anchor.innerHTML = html;
            anchor.href= url;
            anchor.target = '_blank';
            return anchor;
        },
        
        // the following methods uses htmlFor instead of making the input a child of the label
        // because couldn't get JQuery buttons to work for radio buttons otherwise
        // and because of a comment about disability software
        // see http://stackoverflow.com/questions/774054/should-i-put-input-tag-inside-label-tag
        
        create_text_input: function (value, class_name, label, title, documentation_url) {
            var input = document.createElement("input");
            var label_element, container, documentation_anchor;
            input.type = "text";
            input.className = class_name;
            input.value = value;
            input.title = title;
            if (label) {
                label_element = document.createElement("label");
                label_element.innerHTML = label;
                input.id = TT.UTILITIES.generate_unique_id();
                label_element.htmlFor = input.id;
                if (documentation_url) {
                    documentation_anchor = TT.UTILITIES.create_anchor_element("?", documentation_url);
                    $(documentation_anchor).button();
                }
                container = TT.UTILITIES.create_horizontal_table(label_element, input, documentation_anchor);
                $(label_element).addClass("ui-widget");
            } else {
                container = input;
            }     
            $(input).button().addClass("toontalk-text-input");
            $(input).css({"background-color": "white"});
            return {container: container,
                    button: input};
        },
        
        create_text_area: function (value, class_name, label, title) {
            var text_area = document.createElement("textarea");
            var label_element, container;
            text_area.className = class_name;
            text_area.value = value;
            text_area.title = title;
            label_element = document.createElement("label");
            label_element.innerHTML = label;
            text_area.id = TT.UTILITIES.generate_unique_id();
            label_element.htmlFor = text_area.id;
            container = TT.UTILITIES.create_horizontal_table(label_element, text_area);
            $(text_area).button().addClass("toontalk-text-text_area");
            $(text_area).css({"background": "white"});
            $(label_element).addClass("ui-widget");
            return {container: container,
                    button: text_area};
        },
        
        create_radio_button: function (name, value, class_name, label, title) {
            var container = document.createElement("div");
            var input = document.createElement("input");
            var label_element = document.createElement("label");
            input.type = "radio";
            input.className = class_name;
            input.name = name;
            input.value = value;
            label_element.innerHTML = label;
            input.id = TT.UTILITIES.generate_unique_id();
            label_element.htmlFor = input.id;
            container.appendChild(input);
            container.appendChild(label_element);
            container.title = title;
            // the following breaks the change listener
            // used to work with use htmlFor to connect label and input
            $(input).button();
//             $(label_element).button();
            return {container: container,
                    button: input,
                    label: label_element};
        },
        
        create_check_box: function (value, class_name, label, title) {
            var container = document.createElement("div");
            var input = document.createElement("input");
            var label_element = document.createElement("label");
            input.type = "checkbox";
            input.className = class_name;
            input.checked = value;
            label_element.innerHTML = label;
            input.id = TT.UTILITIES.generate_unique_id();
            label_element.htmlFor = input.id;
            $(label_element).addClass("ui-widget");
            container.appendChild(input);
            container.appendChild(label_element);
            container.title = title;
//             $(input).button(); // commented out since looked bad
            return {container: container,
                    button: input,
                    label: label_element};
        },

        create_horizontal_table: function () { // takes any number of parameters
            var table = document.createElement("table");
            var i, row, table_element;
            row = document.createElement("tr");
            table.appendChild(row);
            for (i = 0; i < arguments.length; i++) {
                if (arguments[i]) {
                    table_element = document.createElement("td");
                    row.appendChild(table_element);
                    table_element.appendChild(arguments[i]);
                }
            }
            return table;
        },
        
        create_vertical_table: function () { // takes any number of parameters
            var table = document.createElement("table");
            var i, row;
            for (i = 0; i < arguments.length; i++) {
                if (arguments[i]) {
                    row = TT.UTILITIES.create_row(arguments[i]);
                    table.appendChild(row);
                }
            }
            return table;
        },
        
        create_row: function () { // any number of elements
            var row = document.createElement("tr");
            var table_element = document.createElement("td");
            var i;
            for (i = 0; i < arguments.length; i++) {
                row.appendChild(arguments[i]);
            }
            table_element.appendChild(row);
            return row;
        },
        
        selected_radio_button: function () {
            var i, selected;
            for (i = 0; i < arguments.length; i++) {
                if (arguments[i].checked) {
                    return arguments[i];
                }
            }
            return selected;
        },
        
        create_image: function (url, class_name) {
            // if URL is relative and the images folder then an error handler is added
            // that attempts to use a version on a server
            var image = document.createElement("img");
            var error_handler;
            image.src = url; // causes Caja error
            if (class_name) {
                $(image).addClass(class_name);
            }
            if (url.indexOf('images/') === 0) {
                // is a relative URL to images folder so add error handler
                // that tries again with github server
                error_handler = function (event) {
                    image.removeEventListener('error', error_handler);
                    image.src = "http://toontalk.github.io/ToonTalk/" + url;
                }
                image.addEventListener('error', error_handler);
            }
            return image;  
        },
        
        get_dragee: function () {
            return dragee;
        },
        
        add_a_or_an: function (word, upper_case) {
            var first_character = word.charAt(0);
            if ("aeiou".indexOf(first_character) < 0) {
                if (upper_case) {
                    return "A " + word;
                }
                return "a " + word;
            }
            if (upper_case) {
                return "An " + word;
            }
            return "an " + word;
        },
        
        maximum_string_length: function (string, maximum_length) {
            // replaces middle of string with ... if needed -- doesn't count the ... as part of the length
            var first_part;
            if (string.length <= maximum_length) {
                return string;
            }
            first_part = string.substring(0, Math.round(maximum_length * .75));
            return first_part + " ... " + string.substring(string.length-(maximum_length-first_part.length));
        },
        
        backup_all: function (immediately) {
            var top_level_widget = TT.UTILITIES.get_toontalk_widget_from_jquery($(".toontalk-top-level-backside"));
            var backup_function = function () {
                    var json = TT.UTILITIES.get_json_top_level(top_level_widget);
                    try {
                        window.localStorage.setItem(TT.UTILITIES.current_URL(), JSON.stringify(json));
                    } catch (error) {
                        TT.UTILITIES.display_message("Failed to save state to local storage since it requires " + JSON.stringify(json).length + " bytes. Error message is " + error);
                    }
            };
            if (top_level_widget) {
                if (immediately) {
                    backup_function();
                }
                // delay it so the geometry settles down
                setTimeout(backup_function, 100);
            }
        },
        
        make_resizable: function ($element, widget) {
            $element.resizable({resize: function (event, ui) {
                                    // following needed for element widget's that are images
                                    $element.find("img").css({width:  ui.size.width,
                                                              height: ui.size.height});
                                    widget.render();
                                },
                               // the corner handles looked bad on element widgets
                               // and generally got in the way
                               handles: "n,e,s,w"
                               });
        },
        
        match: function (pattern, widget) {
            var match_status = pattern.match(widget);
            if (match_status === 'not matched' && widget.matched_by) {
                // e.g. widget is a nest             
                return widget.matched_by(pattern);
            }
            return match_status;
        },
        
        current_URL: function () {
            var queryStart = window.location.href.indexOf('?');
            if (queryStart < 0) {
                return window.location.href;
            }
            return window.location.href.substring(0, queryStart);
        },
        
        get_side_element_from_side: function (side, create) {
            if (!side) {
                return side;
            }
            if (side.is_backside) {
                return side.widget.get_backside_element(create);
            }
            return side.widget.get_frontside_element(create);
        },
        
        copy_side: function (side, just_value, dimensions_too) {
            var widget_copy = side.widget.copy(just_value);
            var frontside_element, copy_frontside_element;
            if (dimensions_too) {
                frontside_element = side.widget.get_frontside_element();
                if (frontside_element) {
                    copy_frontside_element = widget_copy.get_frontside_element(true);
                    $(copy_frontside_element).css({width:  $(frontside_element).width(),
                                                   height: $(frontside_element).height()});
                }
            }
            return {widget: widget_copy,
                    is_backside: side.is_backside};
        },
        
        scale_to_fit: function (this_element, other_element, original_width, original_height) {
            var new_width = $(other_element).width();
            var new_height = $(other_element).height();
            var x_scale, y_scale;
            if (!original_width) {
                original_width = $(this_element).width();
            }
            if (!original_height) {
                original_height = $(this_element).height();
            }
            x_scale = new_width/original_width;
            y_scale = new_height/original_height;
            $(this_element).css({transform: "scale(" + x_scale + ", " + y_scale + ")",
                                 "transform-origin": "top left", 
                                 width:  original_width,
                                 height: original_height});
            return {x_scale: x_scale,
                    y_scale: y_scale};
        },
        
        relative_position: function (target_element, reference_element) {
             var target_offset = $(target_element).offset();
             var reference_offset = $(reference_element).offset();
             return {left: target_offset.left-reference_offset.left,
                     top:  target_offset.top-reference_offset.top};
        },
        
        add_animation_class: function (element, class_name) {
            // if any code set the size explicitly then the animation won't display correctly
            $(element)
                .css({width:  '',
                      height: ''})
                .addClass(class_name);
        },
        
        get_toontalk_widget_from_jquery: function ($element) {
            if ($element.length > 0) {
                return $element.get(0).toontalk_widget;
            }
        },
        
        has_animating_image: function (element) {
            var $element = $(element);
            var animation = $element.css("animation") ||
                            $element.css("webkit-animation") ||
                            $element.css("moz-animation") ||
                            $element.css("ms-animation") ||
                            $element.css("o-animation");
            // rewrite using startsWith in Ecma 6
            return animation && animation.indexOf("none") !== 0;
        },

        display_message: function (message) {
            alert(message); // for now
        }
        
//         create_menu_item: function (text) {
//             var item = document.createElement("li");
//             var anchor = document.createElement("a");
//             anchor.innerHTML = text;
//             anchor.href = "#";
//             item.appendChild(anchor);
//             return item;
//         }
    
    };
    
}(window.TOONTALK));

window.TOONTALK.UTILITIES.available_types = ["number", "box", "element", "robot", "top-level"];
