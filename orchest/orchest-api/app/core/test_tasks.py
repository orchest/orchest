from tasks import Pipeline


def create_pipeline_json():
    """
        1 -- > 2
    """
    pipeline = {
        'name': 'pipeline-name',
        'steps': {
            'uuid-1': {
                'incoming_connections': [],
                'name': 'step-1',
                'uuid': 'uuid-1'
            },
            'uuid-2': {
                'incoming_connections': ['uuid-1'],
                'name': 'step-2',
                'uuid': 'uuid-2'
            }
        }
    }
    return pipeline


def main():
    description = create_pipeline_json()

    pipeline = Pipeline.from_json(description)

    print(pipeline.sentinel)

    print(pipeline.incoming('uuid-1'))
    print(pipeline.incoming('uuid-2'))

    print()
    print(pipeline.get_subgraph(['uuid-2']))


if __name__ == '__main__':
    main()
