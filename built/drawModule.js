"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var elkGraph_1 = require("./elkGraph");
var Skin_1 = require("./Skin");
var _ = require("lodash");
var onml = require("onml");
var WireDirection;
(function (WireDirection) {
    WireDirection[WireDirection["Up"] = 0] = "Up";
    WireDirection[WireDirection["Down"] = 1] = "Down";
    WireDirection[WireDirection["Left"] = 2] = "Left";
    WireDirection[WireDirection["Right"] = 3] = "Right";
})(WireDirection || (WireDirection = {}));
function drawModule(g, module) {
    var nodes = module.getNodes().map(function (n) {
        var kchild = _.find(g.children, function (c) { return c.id === n.Key; });
        return n.render(kchild);
    });
    removeDummyEdges(g);
    var lines = _.flatMap(g.edges, function (e) {
        var netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        var netName = 'net_' + netId.slice(1, netId.length - 1);
        return _.flatMap(e.sections, function (s) {
            var startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            var bends = s.bendPoints.map(function (b) {
                var l = ['line', {
                        x1: startPoint.x,
                        x2: b.x,
                        y1: startPoint.y,
                        y2: b.y,
                        class: netName,
                    }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                var circles = e.junctionPoints.map(function (j) {
                    return ['circle', {
                            cx: j.x,
                            cy: j.y,
                            r: 2,
                            style: 'fill:#000',
                            class: netName,
                        }];
                });
                bends = bends.concat(circles);
            }
            var line = [['line', {
                        x1: startPoint.x,
                        x2: s.endPoint.x,
                        y1: startPoint.y,
                        y2: s.endPoint.y,
                        class: netName,
                    }]];
            return bends.concat(line);
        });
    });
    var svg = Skin_1.default.skin.slice(0, 2);
    svg[1].width = g.width;
    svg[1].height = g.height;
    var styles = _.filter(Skin_1.default.skin, function (el) {
        return el[0] === 'style';
    });
    var ret = svg.concat(styles).concat(nodes).concat(lines);
    return onml.s(ret);
}
exports.default = drawModule;
function which_dir(start, end) {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('start and end are the same');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('start and end arent orthogonal');
    }
    if (end.x > start.x) {
        return WireDirection.Right;
    }
    if (end.x < start.x) {
        return WireDirection.Left;
    }
    if (end.y > start.y) {
        return WireDirection.Down;
    }
    if (end.y < start.y) {
        return WireDirection.Up;
    }
    throw new Error('unexpected direction');
}
function findBendNearDummy(net, dummyIsSource, dummyLoc) {
    var candidates = net.map(function (edge) {
        var bends = edge.sections[0].bendPoints || [null];
        if (dummyIsSource) {
            return _.first(bends);
        }
        else {
            return _.last(bends);
        }
    }).filter(function (p) { return p !== null; });
    return _.minBy(candidates, function (pt) {
        return Math.abs(dummyLoc.x - pt.x) + Math.abs(dummyLoc.y - pt.y);
    });
}
function removeDummyEdges(g) {
    // go through each edge group for each dummy
    var dummyNum = 0;
    var _loop_1 = function () {
        var dummyId = '$d_' + String(dummyNum);
        // find all edges connected to this dummy
        var edgeGroup = _.filter(g.edges, function (e) {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            return "break";
        }
        var dummyIsSource;
        var dummyLoc = void 0;
        if (edgeGroup[0].source === dummyId) {
            dummyIsSource = true;
            dummyLoc = edgeGroup[0].sections[0].startPoint;
        }
        else {
            dummyIsSource = false;
            dummyLoc = edgeGroup[0].sections[0].endPoint;
        }
        var newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        for (var _i = 0, edgeGroup_1 = edgeGroup; _i < edgeGroup_1.length; _i++) {
            var edge = edgeGroup_1[_i];
            var section = edge.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.shift();
                }
            }
            else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }
        // delete junction point if necessary
        var directions = new Set(_.flatMap(edgeGroup, function (edge) {
            var section = edge.sections[0];
            if (dummyIsSource) {
                // get first bend or endPoint
                if (section.bendPoints) {
                    return [section.bendPoints[0]];
                }
                return section.endPoint;
            }
            else {
                if (section.bendPoints) {
                    return [_.last(section.bendPoints)];
                }
                return section.startPoint;
            }
        }).map(function (pt) {
            if (pt.x > newEnd.x) {
                return WireDirection.Right;
            }
            if (pt.x < newEnd.x) {
                return WireDirection.Left;
            }
            if (pt.y > newEnd.y) {
                return WireDirection.Down;
            }
            return WireDirection.Up;
        }));
        if (directions.size < 3) {
            // remove junctions at newEnd
            edgeGroup.forEach(function (edge) {
                if (edge.junctionPoints) {
                    edge.junctionPoints = edge.junctionPoints.filter(function (junct) {
                        return !_.isEqual(junct, newEnd);
                    });
                }
            });
        }
        dummyNum += 1;
    };
    // loop until we can't find an edge group or we hit 10,000
    while (dummyNum < 10000) {
        var state_1 = _loop_1();
        if (state_1 === "break")
            break;
    }
}
exports.removeDummyEdges = removeDummyEdges;
