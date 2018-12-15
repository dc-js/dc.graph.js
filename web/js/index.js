d3.select('img.animate').on({
    mouseenter: function(d) {
        this.src = "img/screenshots/" + this.id + ".gif";
    },
    mouseleave: function(d) {
        this.src = "img/screenshots/" + this.id + ".png";
    }
});
