use std::time::Duration;

fn main() {
    let start_time = std::time::Instant::now();

    let mut compiler = capnpc::CompilerCommand::new();
    compiler.import_path("lib/");

    for entry in std::fs::read_dir(".").unwrap() {
        let entry = entry.unwrap();
        if entry.file_type().unwrap().is_file() {
            let name = entry.file_name().into_string().unwrap();
            if name.ends_with(".capnp") {
                compiler.file(&entry.path());
            }
        }
    }

    compiler.run().unwrap();

    let elapsed = start_time.elapsed();
    if elapsed > Duration::from_millis(500) {
        eprintln!("cargo:warning=Build script took took {elapsed:?}");
    } else {
        eprintln!("Build script took {elapsed:?}");
    }
}
