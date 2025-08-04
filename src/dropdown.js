import { property } from './core.js';

export function dropdown() {
    dropdown.unique_id = (dropdown.unique_id || 16) + 1;
    const _dropdown = {
        id: `id${  dropdown.unique_id}`,
        parent: property(null),
        show(key, x, y) {
            const dropdown = _dropdown.parent().root()
                .selectAll(`div.dropdown.${  _dropdown.id}`).data([0]);
            const dropdownEnter = dropdown
                .enter().append('div')
                .attr('class', `dropdown ${  _dropdown.id}`);
            dropdown
                .style('visibility', 'visible')
                .style('left', `${x  }px`)
                .style('top', `${y  }px`);
            let capture;
            const hides = _dropdown.hideOn().split('|');
            const selects = _dropdown.selectOn().split('|');
            if(hides.includes('leave'))
                dropdown.on('mouseleave', () => {
                    dropdown.style('visibility', 'hidden');
                });
            else if(hides.includes('clickout')) {
                const diagram = _dropdown.parent();
                capture = diagram.svg().append('rect')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('width', diagram.width())
                    .attr('height', diagram.height())
                    .attr('opacity', 0)
                    .on('click', () => {
                        capture.remove();
                        dropdown.style('visibility', 'hidden');
                    });
            }
            let container = dropdown;
            if(_dropdown.scrollHeight()) {
                let height = _dropdown.scrollHeight();
                if(typeof height === 'number')
                    height = `${height  }px`;
                dropdown
                    .style('max-height', height)
                    .property('scrollTop', 0);
                dropdownEnter
                    .style('overflow-y', 'auto')
                  .append('div')
                    .attr('class', 'scroller');
                container = dropdown.selectAll('div.scroller');
            }
            const _values = _dropdown.fetchValues()(key, (values) => {
                const items = container
                    .selectAll('div.dropdown-item').data(values);
                items
                    .enter().append('div')
                    .attr('class', 'dropdown-item');
                items.exit().remove();
                let select_event = null;
                if(selects.includes('click'))
                    select_event = 'click';
                else if(selects.includes('hover'))
                    select_event = 'mouseenter';
                items
                    .text((item) => _dropdown.itemText()(item));
                if(select_event) {
                    items
                        .on(`${select_event  }.select`, (d) => {
                            _dropdown.itemSelected()(d);
                        });
                }
                if(hides.includes('clickitem')) {
                    items
                        .on('click.hide', (_d) => {
                            capture.remove();
                            dropdown.style('visibility', 'hidden');
                        });
                }
            });
        },
        hideOn: property('clickout|clickitem'),
        selectOn: property('click'),
        height: property(10),
        itemText: property((x) => x),
        itemSelected: property(() => {}),
        fetchValues: property((key, k) => { k([]); }),
        scrollHeight: property('12em')
    };
    return _dropdown;
};
