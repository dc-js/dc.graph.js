var nepal_queries = [
    {
        name: 'vnf_hosts',
        description: 'Find all hosts on which VNF runs',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VNF(name = "$$1$$")->[Hosted()]{1,5}->Host()
	and length(P) <= 5`,
        select1: {
            name: 'VNF',
            default: 'DNS_VNF',
            init: function(nodes, edges) {
                return nodes.filter(function(n) {
                    return raw_node_type(n) === 'VNF';
                }).map(function(n) {
                    return n.name;
                });
            }
        }
    },
    {
        name: 'host_vfcs',
        description: 'Find all VFCs running on a given host',
        query: `Retrieve P
from PATHS P
where
        P MATCHES VFC()->[Hosted()]{1,5}->Host(name = "$$1$$")
        and length(P) <= 5`,
        select1: {
            name: 'Host',
            default: 'wt2cwa1esx207',
            init: function(nodes, edges) {
                return nodes.filter(function(n) {
                    return raw_node_type(n) === 'Host';
                }).map(function(n) {
                    return n.name;
                });
            }
        }
    },
    {
        name: 'windows_vfcs',
        description: 'Find all VFCs running on VMs with Windows Server and hypervisor with 10 NICs',
        query: `Retrieve P
from PATHS P
where
        P MATCHES VFC()->[Hosted()]{1,5}->VM(vm_os="Microsoft Windows Server 2012 (64-bit)")->Host(hw_num_nics=10)
        and length(P) <= 5`
    },
    {
        name: 'vnf_vnfs',
        description: 'Find all VNFs that talk to VNF',
        query: `Retrieve P
from PATHS P
where
        P MATCHES VNF(name = "$$1$$")->[Connects()]{1,2}->VNF()
        and length(P) <= 5`,
        select1: {
            name: 'VNF',
            default: 'FW_VNF',
            init: function(nodes, edges) {
                return nodes.filter(function(n) {
                    return raw_node_type(n) === 'VNF';
                }).map(function(n) {
                    return n.name;
                });
            }
        }
    }
];

