import { select } from 'd3-selection';

select('img.animate').on('mouseenter', function() {
    this.src = 'img/screenshots/'+this.id+'.gif';
}).on('mouseleave', function() {
    this.src = 'img/screenshots/'+this.id+'.png';
});
