import sys

colors = ['black', 'blue', 'red', 'green', 'purple', 'brown']
def print_tree(parent, depth, breadth):
    if not depth:
        return
    children = [parent + chr(ord('0')+i) for i in range(breadth)]
    color = colors[len(parent)-1]
    for child in children:
        print(' '*4, parent, '->', child, f'[color={color}]')
    for child in children:
        print_tree(child, depth-1, breadth)

depth = int(sys.argv[1]) if len(sys.argv) > 1 else 3
breadth = int(sys.argv[2]) if len(sys.argv) > 2 else 2
print('digraph tree {')
print_tree('T', depth, breadth)
print('}')
