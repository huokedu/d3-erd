// menu click handler
d3.select("[href=\"#addNode\"]")
  .on("click", function () { return d3.event.preventDefault(), addNode = true });

// helpers
function compose(/* Function... */) {
    var fns = arguments;

    return function (result) {
      for (var i = fns.length - 1; i > -1; i--)
        result = fns[i].call(this, result);

      return result;
    }
}

function translate(x, y) {
  return function (d) {
    return "translate(" + x(d) + ", " + y(d) + ")";
  }
}

function fn(name /* args... */) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function (obj) {
    return obj ? obj[name] ? obj[name].apply(obj, args) : undefined : undefined;
  }
}

function self() {
  return this;
}

function id(x) {
  return x;
}

function prop(name) {
  if (name.indexOf(".") > -1)
    return compose.apply(null, name.split(".").map(function(_, i, names){
      return prop(names[names.length - i - 1]);
    }));

  return function (obj) {
    return obj ? obj[name] : undefined
  }
}

function div(b) {return function(a) {return isFinite(a) ? a / b : undefined}}
function mul(b) {return function(a) {return isFinite(a) ? a * b : undefined}}
function add(b) {return function(a) {return isFinite(a) ? a + b : undefined}}
function sub(b) {return function(a) {return isFinite(a) ? a - b : undefined}}

var half = div(2);
var double = mul(2);

// create a node
function makeNode(name, x, y){
  return {
    x: x || 0,
    y: y || 0,
    name: name || "unnamed",
    height: "2em",
    width: "6em"
  }
}

// create a link
function makeLink(a, b) {
  return {
    left: a,
    right: b
  }
}

// initial graph
var graph = {nodes: [], links: [], history: []};

// constants
var height = 400,
    width = 400;

// canvas
var svg = d3.select("svg")
    .attr("height", height)
    .attr("width", width)
    .on("mousedown", mousedown)
    .on("mousemove", mousemove);

// hold the state which menu item has been
// clicked last
var addNode = false,
    newLink = null;

// select nodes and links
var node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

// mouseover handler
function mousemove() {
  if (!newLink)
    return;

  var point = d3.mouse(this);
  svg.selectAll(".new-link")
    .attr("x2", point[0])
    .attr("y2", point[1]);
}

// mousdown handler
function mousedown() {
  var point = d3.mouse(this);

  if (addNode) {
    graph.nodes.push(makeNode(prompt("give the node a name"),
                              point[0],
                              point[1]));

    addNode = false;
    draw();
  }
}

// create a link
function addLink(d) {
  if (!newLink) {
    newLink = {left: d};
    svg.append("line")
      .attr("x1", newLink.left.x)
      .attr("y1", newLink.left.y)
      .attr("x2", newLink.left.x)
      .attr("y2", newLink.left.y)
      .attr("class", "new-link");

  } else {
    newLink.right = d;
    var offset = 20;
    var n = newLink;
    n.path = [{x: n.left.x, y: n.left.y}, {x: n.right.x, y: n.right.y}];

    if (n.left.anchor === n.right.anchor && (n.right.anchor === "north" || n.right.anchor === "south")) {
      var a = n.left.x, b = n.right.x, s = n.left.anchor === "south";
      var p = {x: a + (b - a)/2,
               y: Math[s ? "max" : "min"](n.left.y, n.right.y) + (s ? 1 : -1) * offset};
      n.path.splice(1, 0, p);
      n.start = "v";
    } else if ((n.left.anchor === "south" && n.right.anchor === "north")
               || (n.left.anchor === "north" && n.right.anchor === "south")){
      var a = n.left.x, b = n.right.x,
          c = n.left.y, d = n.right.y,
          e = (b-a)/4;
      var p = {x: a + 1 * e, y: n.left.y + (n.left.anchor === "south" ? 1 : -1) * offset};
      var q = {x: a + 2 * e, y: c + (d - c)/2};
      var r = {x: a + 3 * e, y: n.right.y + (n.right.anchor === "south" ? 1 : -1) * offset};
      if ((n.left.anchor === "south" && n.right.anchor === "north" && n.left.y < n.right.y)
          ||(n.left.anchor === "north" && n.right.anchor === "south" && n.left.y > n.right.y))
        newLink.path.splice(1, 0, q);
      else
        newLink.path.splice(1, 0, p, q, r);
      newLink.start = "v";
    } else if (n.left.anchor === n.right.anchor && (n.right.anchor === "west" || n.right.anchor === "east")) {
      var a = n.left.y, b = n.right.y, w = n.left.anchor === "west";
      var p = {x: Math[w ? "min" : "max"](n.left.x, n.right.x) + (w ? -1 : 1) * offset,
               y: a + (b - a)/2};
      n.path.splice(1, 0, p);
      n.start = "h";
    } else if ((n.left.anchor === "east" && n.right.anchor === "west")
               || (n.left.anchor === "west" && n.right.anchor === "east")){
      var a = n.left.y, b = n.right.y,
          c = n.left.x, d = n.right.x,
          e = (b-a)/4;
      var p = {y: a + 1 * e, x: n.left.x + (n.left.anchor === "west" ? -1 : 1) * offset};
      var q = {y: a + 2 * e, x: c + (d - c)/2};
      var r = {y: a + 3 * e, x: n.right.x + (n.right.anchor === "west" ? -1 : 1) * offset};
      if ((n.left.anchor === "east" && n.right.anchor === "west" && n.left.x < n.right.x)
          ||(n.left.anchor === "west" && n.right.anchor === "east" && n.left.x > n.right.x))
        newLink.path.splice(1, 0, q);
      else
        newLink.path.splice(1, 0, p, q, r);
      newLink.start = "h";
    }

    graph.links.push(newLink);
    svg.selectAll(".new-link").remove();
    newLink = null;
    draw();
  }
}

// draw the graph
function draw() {

  // update nodes
  node = node.data(graph.nodes, prop("name"));

  // insert new nodes
  var tmp = node.enter()
      .insert("g")
      .attr("class", "node")
      .attr("transform", translate(prop("x"), prop("y")))
      .each(function(d) {

        // draw a box
        var n = d3.select(this);
        var x = d.x, y = d.y;

        n.append("rect")
          .attr("height", prop("height"))
          .attr("width", prop("width"));

        var bbox = this.getBBox();

        d.anchors = [
          {x: x + bbox.width/2, y: y + 0, node: d, anchor: "north"},
          {x: x + bbox.width, y: y + bbox.height/2, node: d, anchor: "east"},
          {x: x + bbox.width/2, y: y + bbox.height, node: d, anchor: "south"},
          {x: x + 0, y: y + bbox.height/2, node: d, anchor: "west"}
        ];

        // write the title
        n.append("text")
          .attr("class", "title")
          .text(prop("name"))
          .attr("x", bbox.width/2)
          .attr("y", compose(prop("height"), fn("getBBox"), self));

        // draw the "add link" handlers
        n.selectAll("circle")
          .data(d.anchors)
          .enter()
          .append("circle")
          .attr("class", "add-link")
          .attr("r", 5)
          .attr("cx", compose(sub(x), prop("x")))
          .attr("cy", compose(sub(y), prop("y")))
          .on("mousedown", addLink)
          .append("title")
          .text("add link");
      });

  // remove old nodes
  node.exit()
    .remove();

  // update links
  link = link.data(graph.links);

  // insert new links
  link.enter()
    .insert("g", ".node") // insert before first .node
    .attr("class", "link")
    .each(function(d){
      var knees = interpolateKnees().start(d.start)(d.path);

      d3.select(this)
        .append("path")
        .datum(knees)
        .attr("d", d3.svg.line().x(prop("x")).y(prop("y")));

      d3.select(this)
        .selectAll("circle")
        .data(d.path.slice(1, -1))
        .enter()
        .append("circle")
        .attr("class", "handle")
        .attr("cx", prop("x"))
        .attr("cy", prop("y"))
        .attr("r", 5);
    });

  // remove old links
  link.exit()
    .remove();
}

function interpolateKnees() {
  return (function(){
    var x = prop("x"),
        y = prop("y"),
        dir = "v";

    function knees(_data) {
      var data = _data.slice();

      var last = data[data.length - 1],
          cur = data.shift(),
          res = [cur],
          _cur = cur,
          next;

      while (next = data.shift()) {
        res.push(_cur = (dir === "v" ? {d: dir, x: x(_cur), y: y(next)} : {x: x(next), y: y(_cur)}));
        dir = dir === "v" ? "h" : "v";
        next = cur;
      }

      res.push(last);

      return res;
    }

    knees.x = function(fn) {x = fn; return knees};
    knees.y = function(fn) {y = fn; return knees};
    knees.start = function(d) {dir = d; return knees};

    return knees;
  }());
}
