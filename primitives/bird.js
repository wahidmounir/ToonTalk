 /**
 * Implements ToonTalk's birds and nests
 * Authors = Ken Kahn
 * License: New BSD
 */
 
 /*jslint browser: true, devel: true, plusplus: true, vars: true, white: true */

 (function () {
     // start context sharing between bird and nest code
     // ability to set the nest of a bird is private to this context
     var bird_set_nest;
     // a nest copy needs to be updated when it is discovered that its bird was later copied as well
     var update_nest, get_guid, add_nest_copy, remove_nest_copy, make_nest_fresh;

window.TOONTALK.bird = (function (TT) {
    "use strict";
    var bird = Object.create(TT.widget);

    var add_function_choice = function (nest, backside, bird) {
        var type_name = nest.get_function_type();
        var function_object = nest.get_function_object();
        var items = Object.getOwnPropertyNames(TOONTALK.number.function); 
        var select_menu = TT.UTILITIES.create_select_menu("functions", items, "toontalk-select-function", "Which function should I fly to? ", "Click to select the function that this bird will use when given a box.");
        var backside_element = backside.get_element();
        select_menu.menu.addEventListener('change', function (event) {
                nest.set_function_name(event.target.value);
                // update the bird's title (and maybe someday more - e.g. t-shirt)
                bird.rerender();
            });
        backside_element.insertBefore(select_menu.container, backside_element.firstChild);
    };
    
    bird.create = function (nest, description) {
        var new_bird = Object.create(bird);
        var waiting_robots = [];
        bird_set_nest = function (new_value) {
            nest = new_value;
        };
        new_bird.widget_dropped_on_me = function (other, other_is_backside, event, robot) {
            var message_side = other_is_backside ? other.get_backside() : other;
            var frontside_element, fly_continuation;
            if (nest) {
                if (nest.has_ancestor(other)) {
                    TT.UTILITIES.display_message("Bird can't take its nest to its nest!");
                    return false;
                }
                if (nest.visible() || (nest.is_function_nest() && this.visible()) || nest.any_nest_copies_visible()) {
                    // used to include this.visible() || but then when nest was on backside flew off to 0,0
                    other.save_dimensions();
                    // doesn't matter if robot is visible or there is a user event -- if either end visible show the delivery
                    frontside_element = this.get_frontside_element();
                    setTimeout(function () {
                        // delay this since removes geometry until recomputed
                        $(frontside_element).removeClass("toontalk-bird-gimme");
                    });
                    
                    if (robot) {
                        // robot needs to wait until delivery is finished
                        other.robot_waiting_before_next_step = robot;
                        // generalise this with backside support too
                        other.remove_from_parent_of_frontside();
                    }
                    nest.animate_bird_delivery(message_side, this, robot && robot.run_next_step, robot);
                } else {
                    nest.add_to_contents(message_side);
                    if (robot) {
                        robot.run_next_step();
                    }
                }
            } else {
                console.log("to do: handle drop on a nestless bird -- just removes other?");
            }
            if (TT.robot.in_training && event) {
                TT.robot.in_training.dropped_on(other, this);
            }
            return true;
        };
        new_bird.animate_delivery_to = function (message_side, target_side, nest_recieving_message, starting_left, starting_top, after_delivery_continuation, robot) {
            // starting_left and starting_top are optional and if given are in the coordinate system of the top-level backside
            var temporary_bird = !!nest_recieving_message;
            var parent = this.get_parent_of_frontside();
            var bird_frontside_element = this.get_frontside_element();
            var bird_width = $(bird_frontside_element).width();
            var visible_ancestor = this.closest_visible_ancestor_or_frontside();
            var bird_offset = $(visible_ancestor.get_frontside_element()).offset();
            var bird_finished_continuation = function () {
                    var parent_offset = $(parent_element).offset();
                    var become_static, current_waiting_robots;
                    if (temporary_bird) {
                        this.remove();
                    } else {
                        become_static = function () {
                            $(bird_frontside_element).removeClass("toontalk-bird-morph-to-static");
                            $(bird_frontside_element).addClass("toontalk-bird-static");
                            if (parent) {
                                parent.get_widget().rerender();
                            }
                        };
                        bird_frontside_element.style.position = bird_style_position;
                        if (parent_offset) { // undefined if on unwatched backside
                            bird_offset.left -= parent_offset.left;
                            bird_offset.top  -= parent_offset.top;
                        }
                        $(bird_frontside_element).css(bird_offset);
                        if (parent_element) {
                            parent_element.appendChild(bird_frontside_element);
                        }
                        if (parent) {
                            if (parent.get_widget().is_of_type('top-level')) {
                                this.rerender();
                            } else {
                                parent.get_widget().rerender();
                            }
                        }
                        if (restore_contents) {
                            // if bird was inside something go back where it was
                            top_level_widget.remove_backside_widget(this, false, true);
                            restore_contents();
                            if (waiting_robots) {
                                current_waiting_robots = waiting_robots;
                                waiting_robots = [];
                                current_waiting_robots.forEach(function (robot_run) {
                                    robot_run.robot.run(robot_run.context, robot_run.top_level_context, robot_run.queue);
                                });
                            }
                        }
                        TT.UTILITIES.add_animation_class(bird_frontside_element, "toontalk-bird-morph-to-static");
                        TT.UTILITIES.add_one_shot_event_handler(bird_frontside_element, "animationend", 1000, become_static); 
                        if (after_delivery_continuation) {
                            after_delivery_continuation();
                            message_side.robot_waiting_before_next_step = undefined;
                        }
                    }
                }.bind(this);
            var bird_return_continuation = function () {
                    stop_carrying_element();
                    nest_recieving_message.add_to_contents(message_side, this, true);
                    // return to original location
                    TT.UTILITIES.set_timeout(function () {
                            this.fly_to(bird_offset, bird_finished_continuation); 
                        }.bind(this));
                }.bind(this);
            var carry_element = function (element, widget_side) {
                    this.element_to_display_when_flying = element;
                    if (widget_side) {
                        this.update_display();
                        setTimeout(function () {
                            widget_side.update_display();
                        });     
                    }
                    element.width_before_carry  = element.clientWidth;
                    element.height_before_carry = element.clientHeight;
                    // the timeout fixes a problem when a watched robot gives a bird something that
                    // thing carried is displayed displaced to the southeast from where it should be
                    TT.UTILITIES.set_timeout(function () {
                            $(this.element_to_display_when_flying).addClass("toontalk-carried-by-bird")
                                                                  .css({left: '',
                                                                        top:  '',
                                                                        width: '',
                                                                        height: '',
                                                                        position: ''});
                            this.update_display();
                        }.bind(this));
                }.bind(this);
            var stop_carrying_element = function (where_to_leave_it) {
                    if (!this.element_to_display_when_flying) {
                        return;
                    }
                    var width  = this.element_to_display_when_flying.width_before_carry;
                    var height = this.element_to_display_when_flying.height_before_carry;
                    $(this.element_to_display_when_flying).removeClass("toontalk-carried-by-bird");
                    if (where_to_leave_it) { 
                        $(this.element_to_display_when_flying).css({width:  width,
                                                                    height: height});
                        $(bird_frontside_element).closest(".toontalk-top-level-backside").append(this.element_to_display_when_flying);
                        TT.UTILITIES.set_absolute_position($(this.element_to_display_when_flying), where_to_leave_it);
                    } else {
                        $(this.element_to_display_when_flying).remove();
                    }
                    this.element_to_display_when_flying = undefined;
                    this.update_display();
                }.bind(this);
            var delay_between_steps = 300; // milliseconds
            var target_offset, bird_offset, target_frontside_element, parent_element, bird_style_position, width, height,
                $top_level_backside_element, top_level_backside_element_offset, continuation, delivery_continuation, restore_contents,
                nest_contents_frontside_element, nest_width, nest_height, nest_offset, message_element, 
                top_level_widget, top_level_backside_element_bounding_box;
            if (!nest_recieving_message) {
                nest_recieving_message = nest;
            }
            message_element = message_side.get_element();
            carry_element(message_element, message_side);
            if (!target_side.visible() && !this.visible()) {
                // neither are visible so just add contents to nest
                nest_recieving_message.add_to_contents(message_side, this, true);
                return;
            }
            if (!target_side.is_function_nest()) {
                // nests of functions are 'virtual'
                target_frontside_element = target_side.get_widget().closest_visible_ancestor().get_widget().get_frontside_element();
                target_offset = $(target_frontside_element).offset();
                $top_level_backside_element = $(nest_recieving_message.get_frontside_element()).closest(".toontalk-top-level-backside");   
            }
            if (!$top_level_backside_element || !$top_level_backside_element.is("*")) {
                // target (e.g. nest) isn't contributing its top-level backside so use this bird's
                $top_level_backside_element = $(this.get_frontside_element()).closest(".toontalk-top-level-backside");
            }
            top_level_backside_element_bounding_box = $top_level_backside_element.offset();
            if (!top_level_backside_element_bounding_box) {
                top_level_backside_element_bounding_box = {left: 0,
                                                           top:  0};
            }
            if (starting_left) {
                bird_offset = {left: starting_left+top_level_backside_element_bounding_box.left,
                               top:  starting_top +top_level_backside_element_bounding_box.top};
            } else if (bird_offset.left === 0 && bird_offset.top === 0) {
                // don't really know where the bird is so put him offscreen
                bird_offset = {left: -2*bird_width,
                               top:   $top_level_backside_element.height()/2};
            }
            if (!target_offset) {
                // offscreen to the left at vertical center of top-level backside
                target_offset = {left: -2*bird_width,
                                 top:   $top_level_backside_element.height()/2};
            }
            // save some state before clobbering it
            parent_element = bird_frontside_element.parentElement;
            width =  $(bird_frontside_element).width();
            height = $(bird_frontside_element).height();
            bird_style_position = bird_frontside_element.style.position;
            bird_frontside_element.style.position = 'absolute';
            top_level_widget = this.top_level_widget();
            if (parent && parent.get_widget().temporarily_remove_contents) {
                restore_contents = parent.get_widget().temporarily_remove_contents(this, true);
                if (restore_contents) {
                    // if it really did remove the contents
                    top_level_widget.add_to_top_level_backside(this);
                }
            }
            $top_level_backside_element.append(bird_frontside_element); // while flying            
            $(bird_frontside_element).css({left:   starting_left || bird_offset.left-top_level_backside_element_bounding_box.left,
                                           top:    starting_top  || bird_offset.top -top_level_backside_element_bounding_box.top,
                                           width:  width,
                                           height: height
                                           });
            nest_contents_frontside_element = nest_recieving_message.get_contents_frontside_element &&
                                              nest_recieving_message.get_contents_frontside_element();
            if (nest_contents_frontside_element && nest_recieving_message.visible() &&
                (!robot || robot.visible())) {
                // just fly to nest and return if unwatched robot caused this
                // head near the nest (southeast) to set down message,
                // move nest contents,
                // put message on nest
                // and restore nest contents
                nest_width =  $(target_frontside_element).width();
                nest_height = $(target_frontside_element).height();
                nest_offset = $(target_frontside_element).offset();
                top_level_backside_element_bounding_box.max_left = top_level_backside_element_bounding_box.left+$top_level_backside_element.width();
                top_level_backside_element_bounding_box.max_top  = top_level_backside_element_bounding_box.top +$top_level_backside_element.height();
                target_offset.left += nest_width
                target_offset.top  += nest_height;
                // set message down near nest (southeast) 
                var message_offset =  {left: Math.min(nest_offset.left+nest_width,  top_level_backside_element_bounding_box.max_left -nest_width),
                                       top:  Math.min(nest_offset.top +nest_height, top_level_backside_element_bounding_box.max_top  -nest_height)};
                // set contents down near nest (northwest)
                var contents_offset = {left: Math.max(nest_offset.left-nest_width , top_level_backside_element_bounding_box.left),
                                       top:  Math.max(nest_offset.top -nest_height, top_level_backside_element_bounding_box.top)};
                var set_down_message_continuation = function () {
                        var fly_to_nest_continuation = function () {
                            // no other bird should do this once this one begins to fly to the nest to move its contents
                            nest_recieving_message.set_locked(true);
                            this.fly_to(nest_offset, move_nest_contents_continuation, delay_between_steps);
                        }.bind(this);
                        stop_carrying_element(message_offset);
                        if (nest_recieving_message.get_locked()) {
                            // another bird is delivering
                            nest_recieving_message.run_when_unlocked(fly_to_nest_continuation);
                            // should 'busy wait' animatioin
                        } else {
                            fly_to_nest_continuation();
                        }                       
                    }.bind(this);
                var move_nest_contents_continuation = function () {
                        carry_element(nest_contents_frontside_element);
                        this.fly_to(contents_offset, set_down_contents_continuation, delay_between_steps);
                    }.bind(this);
                var set_down_contents_continuation = function () {
                        stop_carrying_element(contents_offset);
                        this.fly_to(message_offset, pickup_message_continuation, delay_between_steps);
                    }.bind(this);
                var pickup_message_continuation = function () {
                        carry_element(message_element, message_side);
                        this.fly_to(nest_offset, deliver_message_continuation, delay_between_steps);
                    }.bind(this);
                var deliver_message_continuation = function () {
                        stop_carrying_element(nest_offset);
                        this.fly_to(contents_offset, move_contents_back_continuation, delay_between_steps);
                    }.bind(this);
                var move_contents_back_continuation = function () {
                        carry_element(nest_contents_frontside_element);
                        this.fly_to(nest_offset, complete_nest_update_continuation, delay_between_steps);
                    }.bind(this);
                var complete_nest_update_continuation = function () {
                        nest_recieving_message.set_locked(false);
                        stop_carrying_element();
                        nest_recieving_message.update_display();
                        bird_return_continuation();
                    }.bind(this);
                this.fly_to(message_offset, set_down_message_continuation, delay_between_steps);
            } else {
                this.fly_to(target_offset,  bird_return_continuation,      delay_between_steps);
            }  
        };
        new_bird.get_json = function (json_history) {
            return {type: "bird",
                    nest: nest && TT.UTILITIES.get_json(nest, json_history)
                   };
        };
        new_bird.copy = function (parameters) {
            // notice that bird/nest semantics is that the nest is shared not copied
            // if a bird and its nest are copied as part of a widget (e.g. a box) 
            // then a new pair is created and linked
            var copy, new_nest, i;
            if (!parameters) {
                copy = this.create(nest, this.get_description());
            } else if (parameters.just_value) {
                copy = this.create(undefined, this.get_description());
            } else {
                if (parameters.nests_copied && parameters.nests_copied[nest]) {
                    new_nest = parameters.nests_copied[nest][0];
                    // turn first copy into a 'fresh' copy
                    make_nest_fresh.call(new_nest);
                    // and make the others treat the fresh copy as their original_nest
                    for (i = 1; i < parameters.nests_copied[nest].length; i++) {
                        update_nest.call(parameters.nests_copied[nest][i], new_nest);
                    }
                    copy = this.create(new_nest, this.get_description());
                } else {
                    copy = this.create(nest, this.get_description());
                }
                if (!parameters.birds_copied) {
                    parameters.birds_copied = {};
                }
                if (!parameters.birds_copied[nest]) {
                    parameters.birds_copied[nest] = [];
                }
                // add to birds of this nest copied before the nest is (if at all)
                parameters.birds_copied[nest].push(copy);       
            }
            return this.add_to_copy(copy, parameters);
        };
        new_bird.run_when_non_empty = function (robot_run) {
            // typically is a robot waiting for this bird to return to a box hole
            waiting_robots.push(robot_run);
        };
        new_bird.create_backside = function () {
            var backside = TT.bird_backside.create(this);
            if (nest && nest.is_function_nest()) {
                add_function_choice(nest, backside, this);
            }
            return backside;
        };
        new_bird.get_custom_title_prefix = function () {
            if (nest) {
                if (nest.is_function_nest()) {
                    return nest.get_function_object().get_description();
                }
                return "Drop something on me and I'll take it to my nest.";
            }
            return "This bird no longer knows where her nest is. She'll get rid of anything you give her.";
        };
        new_bird.toString = function () {
            if (nest) {
                if (nest.is_function_nest()) {
                    return nest.get_function_object().toString();
                }
                return "a bird";
            }
            return "a bird without a nest";
        };
        new_bird = new_bird.add_standard_widget_functionality(new_bird);
        new_bird.set_description(description);
        if (TT.debugging) {
            new_bird.debug_id = TT.UTILITIES.generate_unique_id();
            if (nest) {
                new_bird.debug_string = "a bird with " + nest.debug_string;
            } else {
                new_bird.debug_string = "a bird without a nest";
            }
        }
        return new_bird;
    };

    bird.create_function = function (type_name, description) {
        // default function adds its arguments and gives result to bird
        return bird.create(TT.nest.create_function(description, type_name, 'sum'));
    };
    
    bird.match = function (other) {
        // doesn't matter if erased
        // shouldn't be able to match to see if two birds are identical, right?
        if (other.match_with_any_bird) {
            return other.match_with_any_bird(this);
        }
        return this;
    };
    
    bird.match_with_any_bird = function () {
        return "matched";
    };
    
    bird.update_display = function () {
        var frontside = this.get_frontside(true);
        var backside = this.get_backside(); 
        var bird_image, frontside_element;
        frontside_element = frontside.get_element();
        frontside_element.title = this.get_title();
//      console.log("update display " + $(frontside_element).width() + "x" + $(frontside_element).height());
        if (!$(frontside_element).is(".toontalk-bird, .toontalk-side-animating")) {
            $(frontside_element).addClass("toontalk-bird toontalk-bird-static");
            frontside_element.addEventListener("dragover", function (event) {
                if ($(frontside_element).is(".toontalk-bird-static")) {
                    $(frontside_element).removeClass("toontalk-bird-static");
                    TT.UTILITIES.add_animation_class(frontside_element, "toontalk-bird-gimme");
                }
            });
            frontside_element.addEventListener("dragleave", function (event) {
                if ($(frontside_element).is(".toontalk-bird-gimme")) {
                    $(frontside_element)
                        .addClass("toontalk-bird-static")
                        .removeClass("toontalk-bird-gimme");
                }
            });
        }
        if (this.element_to_display_when_flying) {
            frontside_element.appendChild(this.element_to_display_when_flying);
        } else {
            $(frontside_element).children(".toontalk-side").remove();
        }
        if (backside) {
            backside.rerender();
        }
    };
        
    bird.fly_to = function (target_offset, continuation, delay) {
        // target_offset is page relative coordinates
        // delay if undefined (or zero) means the continuation is run immediately upon reaching the target_offset
        var frontside_element = this.get_frontside_element();
        var bird_offset = $(frontside_element).offset();
        var delta_x = target_offset.left-bird_offset.left;
        var delta_y = target_offset.top-bird_offset.top;
        var angle = Math.atan2(delta_y, delta_x); // in radians
        var region = Math.round((angle/Math.PI+1)*4) % 8;
        var direction = ["toontalk-fly-west", "toontalk-fly-northwest", "toontalk-fly-north", "toontalk-fly-northeast", 
                         "toontalk-fly-east", "toontalk-fly-southeast", "toontalk-fly-south", "toontalk-fly-southwest"][region];
        var bird_position = $(frontside_element).position();
        TT.UTILITIES.add_animation_class(frontside_element, direction);
        var full_continuation = function () {
            $(frontside_element).removeClass(direction);
            if (delay) {
                $(frontside_element).addClass("toontalk-bird-static"); // should be bird-waiting
                setTimeout(continuation, delay);
            } else {
                continuation();
            }
        };
        // duration is proportional to distance
//      console.log("Flying to " + target_offset.left + ", " + target_offset.top + " holding " + (this.element_to_display_when_flying && this.element_to_display_when_flying.className));
        this.animate_to_absolute_position(target_offset, full_continuation);
    };
    
    bird.get_type_name = function (plural) {
        if (plural) {
            return "birds";
        }
        return "bird";
    };
    
    bird.get_help_URL = function () {
        return "docs/manual/birds-nests.html";
    };

    bird.matching_resource = function (other) {
        // should only be one bird resource since bird identity is an issue
        return other.get_type_name && other.get_type_name() === this.get_type_name();
    };
    
    bird.drop_on = function (other, is_backside, event, robot) {
        if (other.widget_dropped_on_me) {
            return other.widget_dropped_on_me(this, false, event, robot);
        }
    };
        
    TT.creators_from_json["bird"] = function (json, additional_info) {
        return TT.bird.create(TT.UTILITIES.create_from_json(json.nest, additional_info), json.description);
    };
    
    return bird;
}(window.TOONTALK));

window.TOONTALK.bird_backside = 
(function (TT) {
    "use strict";
    return {
        create: function (bird) {
            var backside = TT.backside.create(bird);
            backside.add_advanced_settings(true);
            return backside;
        }
        
    };
}(window.TOONTALK));

window.TOONTALK.nest = (function (TT) {
    "use strict";
    var nest = Object.create(TT.widget);
    // following enables nests to invoke private methods of other nests
    var add_copy_private_key = {}; // any unique object is fine
    // following should be updated if CSS is
    var contents_width = function (width) {
        return width * 0.8;
    };
    var contents_height = function (height) {
        return height * 0.8;
    };

    // Nests are uniquely identified by their guid
    // the following should really be a weak table so to not interfere with garbage collection of nests
    // used only when loading JSON
    var guid_to_nest_table = {};
    
    nest.create = function (description, contents, waiting_robots, guid, original_nest) { 
        var new_nest = Object.create(nest);
        var nest_copies;
        if (!contents) {
            contents = [];
        }
        if (!waiting_robots) {
            waiting_robots = [];
        }
        update_nest = function (new_original_nest) {
            if (original_nest) {
                remove_nest_copy.call(original_nest, this);
            }
            original_nest = new_original_nest;
            guid = get_guid.call(new_original_nest);
            add_nest_copy.call(new_original_nest, this);
        };
        get_guid = function () {
            return guid;
        };
        make_nest_fresh = function () {
            if (original_nest) {
                remove_nest_copy.call(original_nest, this);
            }
            original_nest = undefined;
            guid = TT.UTILITIES.generate_unique_id();
        };
        add_nest_copy = function (new_copy) {
            this[add_copy_private_key](new_copy);
        };
        remove_nest_copy = function (old_copy) {
            this[add_copy_private_key](old_copy, true);
        };
        new_nest.matched_by = function (other) {
            if (contents.length > 0) {
                return TT.UTILITIES.match(other, contents[0].get_widget());
            } else {
                // suspend on this nest -- other is reported for help providing useful feedback
                return [[this, other]];
            }
        };
        new_nest.run_when_non_empty = function (robot_run) {
            waiting_robots.push(robot_run);
        };
        new_nest.add_to_contents = function (widget_side, delivery_bird, ignore_copies) {
            var current_waiting_robots, widget_side_copy;
            if (contents.push(widget_side) === 1) {
                if (waiting_robots.length > 0) {
                    // is the first content and some robots are waiting for this nest to be filled
                    // running these robots may cause new waiting robots so set waiting_robots to [] first
                    current_waiting_robots = waiting_robots;
                    waiting_robots = [];
                    current_waiting_robots.forEach(function (robot_run) {
                        $(robot_run.robot.get_frontside_element()).removeClass("toontalk-robot-waiting");
                        robot_run.robot.run(robot_run.context, robot_run.top_level_context, robot_run.queue);
                    });
                }
            } else {
                // is under the top widget
                widget_side.get_widget().hide();
            }
            if (widget_side.is_backside()) {
                widget_side.get_widget().set_parent_of_backside(this);
            } else {
                widget_side.get_widget().set_parent_of_frontside(this);
            }
            if (nest_copies && !ignore_copies) {
                if (delivery_bird) {
                    nest_copies.forEach(function (nest_copy) {
                        if (!nest_copy.has_ancestor(widget_side.get_widget())) {
                            // ignore if nest_copy is inside message
                            nest_copy.animate_bird_delivery(TT.UTILITIES.copy_side(widget_side), delivery_bird);
                        }
                    });                    
                } else {
                    nest_copies.forEach(function (nest_copy) {
                        if (!nest_copy.has_ancestor(widget_side.get_widget())) {
                            // ignore if nest_copy is inside message
                            nest_copy.add_to_contents(TT.UTILITIES.copy_side(widget_side, false, true));
                        }
                    });
                }
            }
            this.rerender();
        };
        new_nest.animate_bird_delivery = function (message_side, bird, continuation, robot) {
            var start_position, bird_parent_element, visible;
            bird.animate_delivery_to(message_side, this, undefined, undefined, undefined, continuation, robot);
            if (nest_copies) {
                start_position = $(bird.closest_visible_ancestor().get_widget().get_frontside_element()).closest(":visible").position();
                bird_parent_element = bird.get_parent_of_frontside().get_element();
                visible = this.visible();
                nest_copies.forEach(function (nest_copy) {
                    var message_copy = TT.UTILITIES.copy_side(message_side, false, visible);
                    var bird_copy, bird_frontside_element;
                    if (!nest_copy.has_ancestor(message_side.get_widget())) {
                        // ignore if nest_copy is inside message
                        if (!nest_copy.visible() && !visible) {
                            // neither are visible so just add contents to nest
                            nest_copy.add_to_contents(message_copy);
                        } else {
                            bird_copy = bird.copy({just_value: true});
                            bird_frontside_element = bird_copy.get_frontside_element(true); 
                            $(bird_parent_element).append(bird_frontside_element);
                            bird_copy.animate_delivery_to(message_copy, nest_copy, nest_copy, start_position.left, start_position.top, undefined, robot);
                        }
                   }
               });
            }
        };
        new_nest.get_contents_frontside_element = function () {
            if (contents.length > 0) {
                return contents[0].get_widget().get_frontside_element();
            }
        };
        new_nest.get_locked = function () {
            return this.locked_for_animating_deliveries;
        };
        new_nest.set_locked = function (new_value) {
            this.locked_for_animating_deliveries = new_value;
            if (!new_value && this.to_run_when_unlocked && this.to_run_when_unlocked.length > 0) {
                // enqueue the oldest listener and run it
                this.to_run_when_unlocked.shift()();
            }
        };
        new_nest.run_when_unlocked = function (listener) {
            if (this.to_run_when_unlocked) {
                this.to_run_when_unlocked.push(listener);
            } else {
                this.to_run_when_unlocked = [listener];
            }
        };
        new_nest.removed_from_container = function (part, backside_removed, event, index, report_error_if_nothing_removed) {
            var removed = contents.shift();
            if (this.visible()) {
                if (removed) {
                    removed.get_widget().restore_dimensions();
                    if (removed.is_backside()) {
                        removed.get_widget().set_parent_of_backside(undefined);
                    } else {
                        removed.get_widget().set_parent_of_frontside(undefined);
                    }
                } else if (report_error_if_nothing_removed) {
                    TT.UTILITIES.report_internal_error("Nothing removed from nest!");
                }
                if (contents.length > 0) {
                    contents[0].set_visible(true);
                    $(contents[0].get_element()).show();
                }
                this.render();
            }
            return removed;
        };
        new_nest.dereference_contents = function (path_to_nest, top_level_context, robot) {
            var widget, nest_offset, $top_level_backside_element, top_level_backside_element_offset, 
                widget_element, nest_element, nest_width, nest_height;
            if (contents.length === 0) {
                return this;
            }
            // e.g. when a robot takes something off the nest
            if (path_to_nest.removing_widget) {
                widget = contents[0];
                robot.remove_from_container(widget, this);
//              widget = this.removed_from_container().get_widget();
                // isn't attached to the DOM because was removed from nest
                if (this.visible()) {
                    nest_element = this.get_frontside_element();
                    nest_offset = $(nest_element).offset();
                    $top_level_backside_element = $(nest_element).closest(".toontalk-backside-of-top-level");
                    top_level_backside_element_offset = $top_level_backside_element.offset();
                    if (!top_level_backside_element_offset) {
                        // perhaps nest is on the back of something
                        top_level_backside_element_offset = {left: 0,
                                                             top:  0};
                    }
                    widget_element = widget.get_frontside_element();
                    nest_width =  $(nest_element).width();
                    nest_height = $(nest_element).height();
                    // left and top are 10%
                    $(widget_element).css({left:   nest_width  * .1 + nest_offset.left - top_level_backside_element_offset.left,
                                           top:    nest_height * .1 + nest_offset.top -  top_level_backside_element_offset.top,
                                           width:  contents_width(nest_width),
                                           height: contents_height(nest_height)});
                    $top_level_backside_element.append(widget_element);
                }
                return widget;
            }
            // act as if the top contents was being dereferenced
            if (path_to_nest.next) {
                return contents[0].get_widget().dereference(path_to_nest.next, top_level_context, robot);
            }
            return contents[0].get_widget();         
        };
        // defined here so that contents and other state can be private
        new_nest.get_json = function (json_history) {
            var waiting_robots_json = 
                waiting_robots && waiting_robots.map(function (robot_run) {
                    // no point jsonifying the queue since for the seeable future there is only one queue
                    return {robot: TT.UTILITIES.get_json(robot_run.robot, json_history),
                            context: robot_run.context && TT.UTILITIES.get_json(robot_run.context, json_history),
                            top_level_context: robot_run.top_level_context && TT.UTILITIES.get_json(robot_run.top_level_context, json_history)};
            });
            return {type: "nest",
                    contents: TT.UTILITIES.get_json_of_array(contents, json_history),
                    guid: guid,
                    original_nest: original_nest && TT.UTILITIES.get_json(original_nest, json_history),
                    waiting_robots: waiting_robots_json
                    // nest_copies are generated as those nests are created
//                  nest_copies: nest_copies && TT.UTILITIES.get_json_of_array(nest_copies, json_history)
                   };
        };
        new_nest.copy = function (parameters) {
            // notice that bird/nest semantics is that the nest is shared not copied
            // unless the nest is copied along with one of its birds
            var contents_copy, copy, new_original_nest;
            if (parameters && parameters.just_value) {
                if (contents.length > 0) {
                    return contents[0].get_widget().copy(parameters);
                }
                return TT.nest.create(this.get_description(), [], [], "in a robot's condition");
            }
            contents_copy = TT.UTILITIES.copy_widget_sides(contents, parameters);
            if (!parameters) {
                copy = TT.nest.create(this.get_description(), contents_copy, [], guid, (original_nest || this));
            } else if (parameters.fresh_copy) {
                // e.g. could be a resource that shouldn't be linked to its copy
                // don't give the copy a GUID if master doesn't have one (e.g. still has egg in nest)
                copy = TT.nest.create(this.get_description(), contents_copy, [], guid && TT.UTILITIES.generate_unique_id());
            } else {
                new_original_nest = (original_nest || this);
                if (parameters.birds_copied && parameters.birds_copied[this]) {
                    if (parameters.nests_copied && parameters.nests_copied[new_original_nest]) {
                        // this nest has already been copied
                        // so make copies use this fresh copy as its original_nest
                        copy = parameters.nests_copied[nest][0].copy();
                        parameters.nests_copied[new_original_nest].forEach(function (nest_copy) {
                            update_nest.call(nest_copy, copy);
                        });                    
                    } else {
                        // create a fresh copy of the nest
                        copy = TT.nest.create(this.get_description(), contents_copy, [], TT.UTILITIES.generate_unique_id());
                    }
                    parameters.birds_copied[this].forEach(function (bird) {
                        bird_set_nest.call(bird, copy);
                    });
                } else {
                    copy = TT.nest.create(this.get_description(), contents_copy, [], guid, new_original_nest);
                }
                if (!parameters.nests_copied) {
                    parameters.nests_copied = {};
                }
                if (parameters.nests_copied[new_original_nest]) {
                    parameters.nests_copied[new_original_nest].push(copy);  
                } else {
                    // first of this group of nest copies to be copied
                    parameters.nests_copied[new_original_nest] = [copy];
                }
            }
            return this.add_to_copy(copy, parameters);
        };
        new_nest.has_contents = function () {
            return contents.length > 0;
        };
        new_nest.dropped_on_other = function (other, other_is_backside, event, robot) {
            var bird, frontside_element, bird_frontside_element, nest_position, 
                hatching_finished_handler, fly_down_finished_handler, bird_fly_continuation;
            if (!guid) {
                guid = TT.UTILITIES.generate_unique_id();
                if (TT.debugging) {
                    new_nest.debug_string = "A nest with " + guid;
                }                
                // create bird now so robot knows about it
                bird = TT.bird.create(this);
                if (robot) {
                    robot.add_newly_created_widget(bird);
                    // since robot dropped the nest it needs to wait (if watched)
                    this.robot_waiting_before_next_step = robot;
                }
                this.rerender();
                frontside_element = this.get_frontside_element(true);
                TT.UTILITIES.add_animation_class(frontside_element, "toontalk-hatch-egg");
                hatching_finished_handler = function () {
                    var backside_where_bird_goes, top_level_backside_element, top_level_backside_position, 
                        resting_left, resting_top, top_level_widget;
                    if (other_is_backside) {
                        backside_where_bird_goes = other.get_backside();
                    } else {
                        // TODO: determine if this should be using this.top_level_widget()
                        top_level_widget = TT.UTILITIES.widget_from_jquery($(frontside_element).closest(".toontalk-top-level-backside"));
                        if (!top_level_widget) {
                            top_level_widget = TT.UTILITIES.widget_from_jquery($(other.get_widget().get_frontside_element(true)).closest(".toontalk-top-level-backside"));     
                        }
                        if (top_level_widget) {
                            backside_where_bird_goes = top_level_widget.get_backside();
                        } else {
                            TT.UTILITIES.report_internal_error("Unable to find the top-level backside for bird to go to.");
                            return;
                        }
                    }
                    top_level_backside_element = backside_where_bird_goes.get_element();
                    top_level_backside_position = $(top_level_backside_element).offset();
                    bird_frontside_element = bird.get_frontside_element(true);
                    $(bird_frontside_element).removeClass("toontalk-bird-static");
                    TT.UTILITIES.add_animation_class(bird_frontside_element, "toontalk-fly-southwest");
                    nest_position = TT.UTILITIES.relative_position(frontside_element, top_level_backside_element);
                    $(bird_frontside_element).css({left: nest_position.left,
                                                   top:  nest_position.top});
                    if (TT.robot.in_training && event) {
                        // bird is a newly created widget
                        TT.robot.in_training.add_newly_created_widget(bird);
                        // robot should not add steps for the hatching of the bird - hence true argument
                        backside_where_bird_goes.widget_dropped_on_me(bird, false, event, undefined, true);
                    } else {
                        backside_where_bird_goes.widget_dropped_on_me(bird, false, event);
                    }
                    $(frontside_element).removeClass("toontalk-hatch-egg")
                                        .addClass("toontalk-empty-nest")
                                        // rely upon toontalk-empty-nest for dimensions (or other classes)
                                        // problem this addresses is nest otherwise is too tall since it needed that
                                        // height while bird was hatching
                                        .css({width:  '',
                                              height: ''});
                    if (this.get_parent_of_frontside().get_widget().get_type_name() === 'top-level') {
                        // due to switch from animation of bird hatching in nest to static nest
                        // position needs adjusting
                        $(frontside_element).css({left: nest_position.left-5,
                                                  top:  nest_position.top+45});
                    }
                    bird_fly_continuation = function () {
                        $(bird_frontside_element).removeClass("toontalk-fly-southwest");
                        TT.UTILITIES.set_timeout(function () {
                                TT.UTILITIES.add_animation_class(bird_frontside_element, "toontalk-fly-down");
                                fly_down_finished_handler = function () {
                                    var become_static = function () {
                                        $(bird_frontside_element)
                                            .removeClass("toontalk-bird-morph-to-static toontalk-side-animating")
                                            .addClass("toontalk-bird-static");
                                    }
                                    $(bird_frontside_element).removeClass("toontalk-fly-down");
                                    TT.UTILITIES.add_animation_class(bird_frontside_element, "toontalk-bird-morph-to-static");
                                    TT.UTILITIES.add_one_shot_event_handler(bird_frontside_element, "animationend", 1000, become_static);
                                    if (robot) {
                                        robot.run_next_step();
                                    }
                                    // following ensures it listens to drag over events to change CSS class
                                    // perhaps there is a better way
                                    bird.update_display();
                                };
                                TT.UTILITIES.add_one_shot_event_handler(frontside_element, "animationend", 1000, fly_down_finished_handler);
                            }.bind(this));
                    }.bind(this);
                    $(bird_frontside_element).removeClass("toontalk-bird-static");
                    resting_left = Math.max(10, nest_position.left-70);
                    // because of the animation the top of the nest is higher than it appears so add more to top target
                    resting_top = Math.max(10, nest_position.top+70);
                    bird.animate_to_absolute_position({left: resting_left+top_level_backside_position.left,
                                                       top:  resting_top +top_level_backside_position.top},
                                                      bird_fly_continuation);
                    this.rerender();
                }.bind(this);
                TT.UTILITIES.add_one_shot_event_handler(frontside_element, "animationend", 2000, hatching_finished_handler);
            }
            return true;
        };
        new_nest.widget_dropped_on_me = function (other, other_is_backside, event, robot) {
            if (event && other.save_dimensions) {
                other.save_dimensions();
            }
            if (contents.length === 0) {
                this.add_to_contents(other_is_backside ? other.get_backside() : other);
                if (other.dropped_on_other) {
                    // e.g. so egg can hatch from nest drop
                    other.dropped_on_other(this, other_is_backside, event, robot);
                } else if (TT.robot.in_training && event) {
                    TT.robot.in_training.dropped_on(other, this);
                }
            } else {
                other.drop_on(contents[0].get_widget(), other_is_backside, event, robot)
            }
            return true;
        };
        new_nest.drop_on = function (other, is_backside, event, robot) {
            if (other.widget_dropped_on_me) {
                other.widget_dropped_on_me(this, false, event, robot);
                return true;
            }
            return false;
        };
        new_nest.element_to_highlight = function () {
            if (contents.length === 0) {
                return this.get_frontside_element();
            }
            return contents[0].get_frontside_element();
        };
        new_nest.update_display = function () {
            var frontside = this.get_frontside(true);
            var backside = this.get_backside(); 
            var frontside_element, top_contents_widget, nest_width, nest_height, contents_backside, contents_side_element;
            frontside_element = frontside.get_element();
            if (contents.length > 0) {
                top_contents_widget = contents[0].get_widget();
                if (contents[0].is_backside()) {
                    contents_backside = top_contents_widget.get_backside(true);
                    contents_side_element = contents_backside.get_element();
                    contents_backside.update_display();
                    contents_backside.scale_to_fit(contents_side_element, frontside_element);
                } else {
                    top_contents_widget.render();
                    contents_side_element = contents[0].get_element();
                }
                nest_width = $(frontside_element).width();
                nest_height = $(frontside_element).height();
                if (nest_width > 0 && nest_height > 0) {
                    // tried to have a CSS class toontalk-widget-on-nest that specified width and height as 80%
                    // but it didn't work well - especially in FireFox
                    // timeout needed when loading otherwise something resets the width and height
                    TT.UTILITIES.set_timeout(function () {
                            var border_adjustment = 2*contents_side_element.toontalk_border_size || 0;
                            var width  = .8*nest_width;
                            var height = .8*nest_height
                            while (border_adjustment*2 >= width ||
                                   border_adjustment*2 >= height) {
                                border_adjustment /= 2;
                            }
                            width  -= border_adjustment;
                            height -= border_adjustment;
                            $(contents_side_element).css({width:  width,
                                                          height: height,
                                                          // offset by 10% -- tried left: 10% but that only worked in first box hole
                                                          left: nest_width*0.1,
                                                          top:  nest_height*0.1});
                            if (top_contents_widget.set_size_attributes) {
                                // e.g. element widgets need to update their attributes
                                top_contents_widget.set_size_attributes(width, height);
                            }
                        },
                        2); // TODO: see if 0 works here
                }
                frontside_element.appendChild(contents_side_element);
                $(frontside_element).addClass("toontalk-empty-nest");
                if (contents[0].is_backside()) {
                    top_contents_widget.set_parent_of_backside(this);
                } else {
                    top_contents_widget.set_parent_of_frontside(this);
                }
            } else {
                frontside_element.title = this.get_title();
                if (guid) {
                    $(frontside_element).removeClass("toontalk-nest-with-egg");
                    $(frontside_element).addClass("toontalk-empty-nest");
                } else {
                    TT.UTILITIES.add_animation_class(frontside_element, "toontalk-nest-with-egg");
                }
            }
            $(frontside_element).addClass("toontalk-nest");
            if (backside) {
                backside.rerender();
            }
        };
        new_nest[add_copy_private_key] = function (nest_copy, remove_copy) {
            if (!nest_copies) {
                if (remove_copy) {
                    return; // nothing to do
                }
                nest_copies = [];
            }
            if (remove_copy) {
                nest_copies.splice(nest_copies.indexOf(nest_copy), 1);
            } else {
                nest_copies.push(nest_copy);
            }
        };
        new_nest.get_path_to = function (widget, robot) {
            var path;
            if (contents.length > 0) {
                if (contents[0].get_widget().get_path_to) {
                    // assuming frontside
                    return contents[0].get_widget().get_path_to(widget, robot);
                } else if (contents[0].get_widget() === widget) {
                    // should dereference the top of the nest
                    return TT.path.to_entire_context();
                }
            }
        };
        new_nest.walk_children = function (child_action) {
            if (contents.length > 0) {
                return child_action(contents[0]);
            };
        };
        new_nest.top_contents_is = function (other) {
            return contents.length > 0 && contents[0].get_widget() === other;
        };
        new_nest.any_nest_copies_visible = function () {
            var found_one = false;
            if (!nest_copies) {
                return false;
            }
            nest_copies.some(function (nest) {
                if (nest.visible()) {
                    found_one = true;
                    return;
                }
            });
            return found_one;
        };
        new_nest.compare_with = function (other) {
            if (contents.length > 0) {
                return contents[0].compare_with(other);
            }
            if (other.compare_with_nest) {
                return -1*other.compare_with_nest(this);
            }
        };
        new_nest.compare_with_nest = function (other_nest) {
            if (contents.length === 0) {
                // both empty
                return 0;
            }
            return 1; // this is heavier than an empty nest
        };
        // TODO: determine if the following should be renamed
        new_nest.compare_with_number = function (other) {
            if (contents.length > 0) {
                return contents[0].compare_with(other);
            }
            return -1; // this is lighter
        };
        new_nest.compare_with_box   = new_nest.compare_with_number;
        new_nest.compare_with_scale = new_nest.compare_with_number;
        new_nest = new_nest.add_standard_widget_functionality(new_nest);
        new_nest.set_description(description);
        if (TT.debugging) {
            new_nest.debug_id = TT.UTILITIES.generate_unique_id();
            if (guid) {
                new_nest.debug_string = "A nest with " + guid;
            } else {
                new_nest.debug_string = "A nest with an egg";
            }
        }
        if (original_nest && guid) {
            original_nest[add_copy_private_key](new_nest);            
        }
        return new_nest;
    };

    nest.create_function = function (description, type_name, function_name) {
        var return_false = function () {
            return false;
        };
        var function_object = TT[type_name] && TT[type_name].function && TT[type_name].function[function_name];
        // message by convention is a box whose first widget should be a bird
        // and whose other widgets are arguments to the function
        var function_nest =
            {get_function_type: 
                function () {
                    return type_name;
                },
            get_function_object: 
                function () {
                    return function_object;
                },
            set_function_name:
                function (new_name) {
                    function_name = new_name;
                    function_object = TT[type_name] && TT[type_name].function && TT[type_name].function[function_name];
                },
            is_function_nest: 
                function () {
                    return true;
                },
            animate_bird_delivery:
                function (message_side, bird, continuation, robot) {
                    bird.animate_delivery_to(message_side, this, undefined, undefined, undefined, continuation, robot);
                },
            get_json: 
                function (json_history) {
                    return {type: 'function_nest',
                            function_type: type_name,
                            function_name: function_object.name};
                },
            add_to_json: TT.widget.add_to_json,
            get_widget:
                function () {
                    return this;
                },
            // following needed for bird to just pass along the contents
            has_ancestor:            return_false,
            visible:                 return_false,
            any_nest_copies_visible: return_false,
            is_backside:             return_false};
        TT.widget.has_parent(function_nest);
        TT.widget.has_description(function_nest);
        TT.widget.add_sides_functionality(function_nest);
        function_nest.set_description(description);
        if (function_object) {
            // the following is run when the nest receives something
            // here it does what the particular function_object indicates
            function_nest.add_to_contents = function_object.respond_to_message;
            if (TT.debugging) {
                function_nest.debug_id = TT.UTILITIES.generate_unique_id();
                function_nest.debug_string = "a function nest that " + function_object.get_description();
            }
        } else {
            TT.UTILITIES.report_internal_error("Cannot create a function nest because TOONTALK." + type_name + "." + function_name + " is not defined.");
        }
        return function_nest;
    };

        
    TT.creators_from_json["function_nest"] = function (json, additional_info) {
        return TT.nest.create_function(json.description, json.function_type, json.function_name);
    };
    
    nest.create_backside = function () {
        return TT.nest_backside.create(this);
    };
    
    nest.match = function (other) {
        // the semantics of matching an uncovered nest is that the other must be a nest (covered or not)
        // paths should be to the entire nest so that a robot can pick up a nest and manipulate it
        if (other.match_nest_with_nest) {
            return other.match_nest_with_nest(this);
        }
        return other;
    };

    nest.match_nest_with_nest = function (other_nest) {
        return "matched";
    };
    
    nest.toString = function () {
        return "a nest"; // good enough for now
    };

    nest.get_help_URL = function () {
        return "docs/manual/birds-nests.html";
    };
    
    nest.get_type_name = function  (plural) {
        if (plural) {
            return "nests";
        }
        return "nest";
    };
    
    nest.matching_resource = function (other) {
        // should only be one nest resource since nest identity is an issue
        return other.get_type_name && other.get_type_name() === this.get_type_name();
    };

    nest.get_custom_title_prefix = function () {
        return "Drop something on my bird and she'll take it here.";
    };
    
    TT.creators_from_json["nest"] = function (json, additional_info) {
        var waiting_robots; // TODO:
        // don't share the nest if this is a copy
        var nest = !json.original_nest && json.guid && guid_to_nest_table[json.guid];
        if (!nest) {
            nest = TT.nest.create(json.description, 
                                  TT.UTILITIES.create_array_from_json(json.contents, additional_info), 
                                  waiting_robots, 
                                  json.guid,
                                  json.original_nest && TT.UTILITIES.create_from_json(json.original_nest, additional_info));
            guid_to_nest_table[json.guid] = nest;                 
        }
        return nest;
    };
    
    return nest;
}(window.TOONTALK));

window.TOONTALK.nest_backside = 
(function (TT) {
    "use strict";
    return {
        create: function (nest) {
            var backside = TT.backside.create(nest);
            backside.add_advanced_settings(true);
            return backside;
        }
        
    };
}(window.TOONTALK));

// end context sharing between bird and nest code
}())
