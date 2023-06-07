use std::fs;

fn main() {
    let mut capnp_files = Vec::new();

    for entry in fs::read_dir("../schema").unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_str().unwrap();
        let ext = path.extension().unwrap().to_str().unwrap();

        if name == "rust" && ext == "capnp" {
            continue;
        }

        if ext != "capnp" {
            continue;
        }

        capnp_files.push(path.to_str().unwrap().to_owned());
    }

    let mut capnpc = capnpc::CompilerCommand::new();
    capnpc.src_prefix("../schema");

    for file in capnp_files {
        capnpc.file(file);
    }

    capnpc.run().unwrap()
}
