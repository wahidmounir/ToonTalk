 /**
 * Implements ToonTalk's sensors (primitive sensors represented by nests)
 * Authors = Ken Kahn
 * License: New BSD
 */
 
 /*jslint browser: true, devel: true, plusplus: true, vars: true, white: true */

window.TOONTALK.sensor = (function (TT) {
    "use strict";
    
    var sensor = Object.create(TT.widget);
    
    var style_contents = function (widget, sensor) {
        if (widget.get_type_name() === 'element') {
            widget.set_attributes('font-size', $(sensor.get_frontside_element(true)).height()*0.5, false, true);
            widget.set_additional_classes("toontalk-string-value-from-sensor");
            if (sensor.visible()) {
                widget.rerender();
            }
        }
    };
    
    sensor.create = function (event_name, attributes_string, description, previous_contents, active, widget, name) {
        // widget is undefined when the event_name is appropriate to associate with window
        var new_sensor = TT.nest.create(description, previous_contents, "sensor", undefined, undefined, name || "sensor");
        var nest_get_json = new_sensor.get_json;
        var nest_update_display = new_sensor.update_display;
        var nest_copy = new_sensor.copy;
        var attributes = attributes_string.split(" ");
        var attribute_values = function (event) {
            return attributes.map(
                function (attribute) {
                    var value;
                    if (attribute === 'keyCode') {
                        // is this a good idea? shouldn't the DOM events be left alone?
                        // perhaps this should be renamed keyChar or something...
                        if (value === 16) {
                            // is only the shift key
                            return "";
                        }
                        value = String.fromCharCode(value);
                        if (!event.shiftKey) {
                            value = value.toLowerCase();
                        }
                    } else {
                        value = event[attribute];
                         if (typeof value === 'undefined') {
                             value = "No " + attribute + " in event " + event + " of sensor " + sensor;
                             TT.UTILITIES.display_message(value);
                         }
                    }
                    return value;
                });
        };
        var attribute_widget = function (value) {
            var value_widget;
            switch (typeof value) {
                case 'number':
                value_widget = TT.number.create(Math.round(value), 1); // integers for now
                break;
                case 'string':
                value_widget = TT.element.create(value           , undefined, undefined, undefined, undefined, undefined, "toontalk-string-value-from-sensor");
                style_contents(value_widget, new_sensor);
                break;
                case 'boolean':
                // for now
                value_widget = TT.element.create(value.toString(), undefined, undefined, undefined, undefined, undefined, "toontalk-string-value-from-sensor");
                style_contents(value_widget, new_sensor);
                break;
            }
            return value_widget;
        };
        var event_listener = function (event) {
            if (!new_sensor.get_active()) {
                return;
            }
            var values = attribute_values(event);
            var visible = new_sensor.visible();
            var $top_level_backside = $(new_sensor.get_frontside_element()).closest(".toontalk-top-level-backside");        
            var value_widget, frontside_element, delivery_bird;
            if (values.length === 1) {
                value_widget = attribute_widget(values[0]);
            } else {
                value_widget = TT.box.create(values.length,
                                             true,
                                             values.map(attribute_widget),
                                             "the values of the " + TT.UTILITIES.conjunction(attributes) + " attributes of " + TT.UTILITIES.add_a_or_an(event_name) + " event.",
                                             attributes.join(";"));
            }     
            if (visible) {
                delivery_bird = TT.bird.create(new_sensor);
                new_sensor.add_to_top_level_backside(delivery_bird);
                value_widget.render();
                // comes from the bottom center
                delivery_bird.animate_delivery_to(value_widget, new_sensor, new_sensor, $top_level_backside.width()/2, $top_level_backside.height());
            } else {
                new_sensor.add_to_contents(value_widget);
            }
        }.bind(this);
        new_sensor.is_sensor = function () {
            return true;
        };
        new_sensor.copy = function (parameters) {
            var copy;
            if (parameters && parameters.just_value && this.has_contents()) {
                return nest_copy.call(this, parameters);
            }
            // note that widget is not copied since there can be multiple sensors of the same widget
            // there is an issue about sensor having access to nest's contents
            // so TT.UTILITIES.copy_widget_sides(contents) not appropriate
            // so perhaps this should be in the same expression as nest to share privately...
            if (parameters) {
                copy = TT.sensor.create(event_name, this.get_attributes_string(), description, undefined, (parameters.copying_resource || active), widget, this.get_name());
            } else {
                copy = TT.sensor.create(event_name, this.get_attributes_string(), description, undefined, active, widget, this.get_name());
            }
            return new_sensor.add_to_copy(copy, parameters);
        };
        new_sensor.get_json = function (json_history) {
            var nest_json = nest_get_json.call(this, json_history);
            nest_json.type = 'sensor';
            nest_json.event_name = event_name;
            nest_json.attribute = this.get_attributes_string();
            nest_json.active = active;
            nest_json.sensor_of = widget && TT.UTILITIES.get_json(widget, json_history);
            return nest_json;
        };
        new_sensor.update_display = function () {
            var $frontside_element = $(this.get_frontside_element());
            nest_update_display.call(this);
            if (active || $frontside_element.is(".toontalk-top-level-resource")) {
                // top-level resources aren't active but look normal
                $frontside_element.addClass("toontalk-sensor-nest");
                $frontside_element.removeClass("toontalk-sensor-inactive-nest");
            } else {
                $frontside_element.addClass("toontalk-sensor-inactive-nest");
                $frontside_element.removeClass("toontalk-sensor-nest");
            }
            $frontside_element.removeClass("toontalk-empty-nest");
        }
        new_sensor.get_type_name = function (plural) {
            if (plural) {
                return "sensors";
            }
            return 'sensor';
        };
        new_sensor.get_help_URL = function () {
            return "docs/manual/sensors.html";
        };
        new_sensor.toString = function () {
            return "a sensor that receives the '" + this.get_attributes_string() + "' attribute of " + event_name + " events";
        };
        new_sensor.get_class_name_with_color = function (base_class_name) {
            return base_class_name;
        };
        new_sensor.get_active = function () {
            // can also be 'temporarily false'
            return active === true;
        };
        new_sensor.restore_active = function () {
            if (active === 'temporarily false') {
                this.set_active(true);
            }
        };
        new_sensor.set_active = function (new_value, initialising) {
            if (active === new_value && !initialising) {
                return;
            }
            if (new_value === true) { // not 'temporarily false'
               if (widget) {
                    widget.get_frontside_element().addEventListener(event_name, event_listener);
                } else {
                    window.addEventListener(event_name, event_listener);
                }
            } else {
                if (widget) {
                    widget.get_frontside_element().removeEventListener(event_name, event_listener);
                } else {
                    window.removeEventListener(event_name, event_listener);
                }
            }
            active = new_value;
        };
        new_sensor.set_running = function (new_value) {
            this.set_active(new_value);
        };
        new_sensor.set_active(active, true);
        new_sensor.create_backside = function () {
            return TT.sensor_backside.create(this);
        };
        new_sensor.get_event_name = function () {
            return event_name;
        };
        new_sensor.set_event_name = function (new_value) {
            var was_active = active;
            if (event_name) {
                if (active) {
                    // this will remove the listeners to the old event_name
                    this.set_active(false);
                }
            }
            event_name = new_value;
            if (was_active) {
                this.set_active(true);
            }
        };
        new_sensor.get_attributes = function () {
            return attributes;
        };
        new_sensor.set_attributes = function (new_value) {
            attributes = new_value.split(" ");
        };
        new_sensor.get_attributes_string = function () {
            return attributes.join(" ");
        };
        new_sensor.match = function (other) {
            // TODO:
            this.last_match = other;
            return this;
        };
        new_sensor.set_sensor_of = function (new_value) {
            widget = new_value;
        };
        new_sensor.get_custom_title_prefix = function () {
            var title = "When a '" + event_name + "' event occurs my bird will bring me the '" + this.get_attributes_string() + "' attribute of the event.";
            if (active) {
                if (!this.get_backside()) {
                    title += " On my back you can change which kind of events and attributes I receive.";
                }
            } else {
                title += " But I'm deactivated and can't receive anything until the 'Listening to events' check box on my back is ticked.";
            }
            return title;
        };
        return new_sensor;
    };
    
    TT.creators_from_json["sensor"] = function (json, additional_info) {
        var previous_contents = TT.UTILITIES.create_array_from_json(json.contents, additional_info);
        var sensor = TT.sensor.create(json.event_name,
                                      json.attribute,
                                      json.description, 
                                      previous_contents,
                                      false,
                                      undefined, // defined below
                                      json.name); // will be (re)set below
                                      // following postponed because of circularity of sensors and their widgets
        if (json.sensor_of) {
            // delay this due to the circularity of sensors and their widgets
            TT.UTILITIES.set_timeout(function () {
                    sensor.set_sensor_of(TT.UTILITIES.create_from_json(json.sensor_of, additional_info));
                    // make sure listeners are updated
                    sensor.set_active(json.active);
                });
        } else {
            sensor.set_active(json.active);
        }
        if (previous_contents.length > 0) {
            setTimeout(function () {
                // delay to give it a chance to be added to the DOM
                previous_contents.forEach(function (side) {
                    style_contents(side.get_widget(), sensor);
                });
            },
            500);
        }
        return sensor;
    };
    
    return sensor;
    
}(window.TOONTALK));

window.TOONTALK.sensor_backside = 
(function (TT) {
    "use strict";
    
    return {
        create: function (sensor) {
            var event_name_input      = TT.UTILITIES.create_text_input(sensor.get_event_name(), 
                                                                       'toontalk-sensor-event-name-input',
                                                                       "Event name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;",
                                                                       "Type here the event name.",
                                                                       "https://developer.mozilla.org/en-US/docs/Web/Events/" + sensor.get_event_name());
            var event_attribute_input = TT.UTILITIES.create_text_input(sensor.get_attributes_string(),
                                                                       'toontalk-sensor-event-attribute-input',
                                                                       "Event attribute",
                                                                       "Type here the event attribute name or names separated by spaces.",
                                                                       "https://developer.mozilla.org/en/docs/Web/API/Event");
            var activate_switch       = TT.UTILITIES.create_check_box(sensor.get_active(),
                                                                      "toontalk-sensor-active-check-box",
                                                                      "Listening to events",
                                                                      "Check the box if you want to make this sensor active.");
            var backside = TT.nest_backside.create(sensor);
            var backside_element = backside.get_element();
            var update_event_name = function () {
                sensor.set_event_name(event_name_input.button.value.trim());
            };
            var update_attributes = function () {
                sensor.set_attributes(event_attribute_input.button.value.trim());
            };
            var advanced_settings_button = $(backside_element).find(".toontalk-settings-backside-button").get(0);
            event_name_input.button.addEventListener(     'change', update_event_name);
            event_attribute_input.button.addEventListener('change', update_attributes);
            $(activate_switch.button).click(function (event) {
                var active = activate_switch.button.checked;
                sensor.set_active(active);
                if (sensor.robot_in_training()) {
                    sensor.robot_in_training().edited(robot, {setter_name: "set_active",
                                                              argument_1: active,
                                                              toString: "change to " + (active ? "active" : "inactive") + " of the " + sensor,
                                                              button_selector: ".toontalk-sensor-active-check-box"});
                }
                sensor.render();
                event.stopPropagation();
            });
            $(backside_element).find(".toontalk-advanced-setting").append(event_name_input.container, event_attribute_input.container, activate_switch.container);
            return backside;
    }};
}(window.TOONTALK));

