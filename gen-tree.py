import sys

colors = ['black', 'blue', 'red', 'green', 'purple', 'brown']
def print_tree(parent, depth):
    if not depth:
        return
    child1 = parent + '0'
    child2 = parent + '1'
    color = colors[len(parent)-1]
    print(' '*4, parent, '->', child1, f'[color={color}]')
    print(' '*4, parent, '->', child2, f'[color={color}]')
    print_tree(child1, depth-1)
    print_tree(child2, depth-1)

dep = int(sys.argv[1]) if len(sys.argv) > 1 else 3
print('digraph tree {')
print_tree('T', dep)
print('}')
