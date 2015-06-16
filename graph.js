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
var height = 600,
    width = 600;

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
      var conn = connector()
					.left(prop("left"))
					.right(prop("right"))
					.offset(20)(d);

      d3.select(this)
				.selectAll("path")
        .data([conn.lines])
        .append("path")
        .attr("d", d3.svg.line().attr("d", prop("lines")));

      d3.select(this)
        .selectAll("circle")
        .data(conn.handles)
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

function connector() {
  return (function(){
    var x = prop("x"),
        y = prop("y"),
				anchor = prop("anchor"),
				left = prop("left"),
				right = prop("right"),
        dir = "v",
				offset = 20;

		var k = function (data) {

			var lines = [],
					handles = [],
					l = left(data),
					r = right(data),
					a = anchor(l),
					b = anchor(r),
					i = 1;

			// simplest case, both anchors in the same direction
			// we need only two fixed points
			if (a === b) {
				(function(){
					var p = {}, q = {};
					if (a === "north" || a === "south") {
						p.x = x(l);
						q.x = x(r);
						if (a === "north")
							p.y = q.y = Math.min(y(l), y(r)) - offset;
						else
							p.y = q.y = Math.max(y(l), y(r)) + offset;
					} else {
						p.y = y(l);
						q.y = y(r);
						if (a === "west")
							p.x = q.x = Math.min(x(l), x(r)) - offset;
						else
							p.x = q.x = Math.max(x(l), x(r)) + offset;
					}
					lines = [l, p, q, r];
				}());
			}

			// anchors show in opposite directions
			// we need 2 or 4 points
			else if ((a === "north" && b === "south")
							 || (a === "south" && b === "north")
							 || (a === "west" && b === "east")
							 || (a === "east" && b === "west")) {

			}

      return {
				lines: lines,
				handles: handles
			};
		}

    k.x = function(f) {x = f; return k};
		k.y = function(f) {y = f; return k};
		k.left = function(f) {left = f; return k};
		k.right = function(f) {right = f; return k};
  	k.anchor = function(f) {anchor = f; return k};
		k.offset = function(o) {offset = o; return k};

    return k;
  }());
}